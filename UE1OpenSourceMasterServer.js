var tcp = require('net');
var udp = require('dgram');

class UnrealMasterServer{
    constructor(addr, port, game){
        this.addr = addr;
        this.port = port;
        this.game = game;
    }
}; // Represents other known Unreal Engine 1 games master servers
   //(original Epic Games Master Server instance or another instance of this OpenSource Master Server Project)

class UnrealGameServer{    
    constructor(ip, port, game, auth){
        this.ip = ip;
        this.port = port;
        this.game = game;
        this.auth = auth; // This server reported to our server and has passed or not authentication
    }
}; // Represents known game servers

var knownMasterServers = [
    new UnrealMasterServer("master0.gamespy.com", 28900, "deusex"),
    new UnrealMasterServer("master.deusexnetwork.com", 28900, "deusex"),
    new UnrealMasterServer("master.dxmp.net", 28900, "deusex"),
    new UnrealMasterServer("master.333networks.com", 28900, "deusex"),
    new UnrealMasterServer("master.oldunreal.com", 28900, "deusex"),
    new UnrealMasterServer("master2.oldunreal.com", 28900, "deusex"),
    new UnrealMasterServer("master.errorist.tk", 28900, "deusex"),
    new UnrealMasterServer("master.fragaholic.com", 28900, "deusex"),
    new UnrealMasterServer("master.noccer.de", 28900, "deusex")
]; // Known master servers array (Classic Epic Games + other Open Source MasterServers)
   // Those are queried every 40 seconds to update this master server's game list

var knownGameServers = []; // Known game servers which announced to this server (this is a HashMap)
var knownGameServersSynced = []; // Known game servers obtained by probing other master servers (this is a HashMap)

var TCPSERVERPORT = 28900; // TCP port (game clients shall query to this port)
var UDPSERVERPORT = 27800; // UDP port (listening game servers's heartbeats on this port)

var HEARTBEATTOLERANCE = 70000; // 70 seconds
var SYNCTIME = 40000; // 40 seconds
var CLEARTIME = 10000; // Every ten seconds, check if some server did not heartbeat for more than 70 seconds

// This server module names (used in logMessage function calls)
var SYNCSYS = "Sync System";
var MASTERSERVERSYS = "Master Server";
var HEARTBEATSYS = "Hearbeat Listener";

// All messages to administrator's log must be logged through this function
function logMessage(type,msg){
    console.log("[ " + type + " ] " + new Date().toLocaleString() + " >> " + msg);
}

/* ----------------------------------------------------------------
 * Sync Module
 * 
 * Queries other master servers for their known game servers, adds
 * their response to our game servers's synced list.
 * 
 * Behaviour :: TCP ACTIVE
 * ----------------------------------------------------------------
 */

// Receives a Unreal Engine 1 Master Server address and fetches it's current known server list, updating our knownGameServersSynced hash.
function syncWithKnownMasterServer(server){
    var VALIDATION = '\\gamename\\' + server.game +'\\location\\0\\validate\\OPNSRCUP\\final\\'; // Validation answer
    var QUERYREQST = '\\list\\gamename\\' + server.game + '\\final\\' // Query for games list

    var conn = new tcp.Socket();

    conn.setTimeout(10000); // 10 seconds before giving up this connection (should take much less).

    // Connection established
    conn.connect(server.port, server.addr, function() {
        logMessage(SYNCSYS,"Syncing with :: " + server.addr);
    });

    // Connection error
    conn.on('error', function(err){
        logMessage(SYNCSYS,"Error when querying known master server :: " + err.toString());
        conn.destroy(); // Ends communication
    });

    // Data received from queried master server
    conn.on('data', function(data) {
        var receivedData = data.toString().split('\\');
        if(receivedData[3] == 'secure'){ // First step, server is challenging us, like this: \basic\secure\XDWAOR
            conn.write(VALIDATION); // Answers anything (DeusEx won't mind)
            conn.write(QUERYREQST); // Sends the query
        }else if(receivedData[receivedData.length - 2] == 'final'){ // Server sent game servers list, like this: \ip\255.255.255.255:7778\ip\255.255.255.255:7778\...\final
            for(var entry of receivedData){
                var gameSvrAddr = entry.split(':');
                if(gameSvrAddr.length == 2){ // Every part of the answer that is a valid game server can be split in two parts with ':'
                    knownGameServersSynced[entry] = new UnrealGameServer(gameSvrAddr[0], gameSvrAddr[1], server.game, 0);
                }
            }
            conn.destroy(); // We got what we want, let's bail (this is actually how the protocol works)
            logMessage(SYNCSYS,"Success with :: " + server.addr);
        }
    });

    conn.on('close', function() {
        logMessage(SYNCSYS,"Ending sync connection with :: " + server.addr);
    });
}

// Syncs with all master servers in knownMasterServers list
function syncWithAll(){
    for(var svr of knownMasterServers){
        syncWithKnownMasterServer(svr);
    }
}

/* ----------------------------------------------------------------
 * Master Server Module
 * 
 * Sends the lists of known game servers to game clients, using TCP.
 * 
 * Behaviour :: TCP PASSIVE
 * ----------------------------------------------------------------
 */

// Generates the string to be sent to a game client querying us for game servers list
function generateClientServerList(game){
    var response = "\\basic\\\\";
    // Servers which reported to us
    for(var svr in knownGameServers){ // svr is the key in which the server info is stored into the HashMap
                                      // but the key was stored in the format address:port, therefore,
                                      // svr is already equal to knownGameServers[svr].address + ":" + knownGameServers[svr].port
        if(knownGameServers[svr].game == game){
            response += "ip\\" + svr + "\\";
        }
    }
    // Servers from other master servers lists
    for(var svr in knownGameServersSynced){
        if(knownGameServersSynced[svr].game == game && knownGameServers[svr] == null){ // Prevents duplicates
            response += "ip\\" + svr + "\\";
        }
    }
    response += "final\\";
    return response;
}

// Handling game client connections.
// For each new connection launches the function passed by parameter.
tcp.createServer(function (client) {
    var VALCHALLANGE = "\\basic\\\\secure\\OPNSRC";
    var challangePass = false;
    var clientAddr = client.remoteAddress + ":" + client.remotePort;
    var gameName = null;

    logMessage(MASTERSERVERSYS, clientAddr + " has connected.");

    client.write(VALCHALLANGE);  // Sends bypassable security challange, key is actually identifying this server as an 
                                 // instance of OpenSource Master Server Project

    // Handle incoming messages from clients.
    client.on('data', function (data) {
        var receivedData = data.toString().split('\\');
        switch(receivedData[1]){
            case 'gamename': // First response according to protocol
                gameName = receivedData[2];
                challangePass = true; // Completely ignores the challange answer.
                break;
            case 'list': // Second response, after passing challange
                client.write(generateClientServerList(challangePass ? gameName : receivedData[3])); // Sends servers list to client
                client.destroy(); // Ends communication
                logMessage(MASTERSERVERSYS, clientAddr + " request fulfilled. Conection closed normally. Authenticated (ignored) ? " + challangePass);
                break;
            default: // Unknown function
                logMessage(MASTERSERVERSYS, clientAddr + " requested unknown " + receivedData[1] + " function.");
                client.destroy();
        }
    });

    // Connection dropped or network problem
    client.on('error', function(err){
        logMessage(MASTERSERVERSYS, "Client connection error :: " + err.toString());
        client.destroy();
    });

    // Remove the client from the list when it leaves
    client.on('end', function () {
        logMessage(MASTERSERVERSYS, clientAddr + " has disconnected itself.");
    });

}).listen(TCPSERVERPORT);

/* ----------------------------------------------------------------
 * Hearbeat Listener Module
 * 
 * Listens to game servers heartbeats and maintains a list with them.
 * 
 * Behaviour :: UDP PASSIVE
 * ----------------------------------------------------------------
 */

// Checks the known game servers list (game servers that sent heartbeats to us)
// for activeness. If the auth variable gets bellow 0, it means the server did
// not responde for more than HEARTBEATTOLERANCE seconds, and will be removed
// from the list.
function clearKnownGameServers(){
    for(var svr in knownGameServers){
        if(knownGameServers[svr].auth < 0){
            knownGameServers[svr] = null;
        }else{
            knownGameServers[svr].auth -= 10;
        }
    }
}

var heartbeatListener = udp.createSocket('udp4'); // The UDP listener socket

heartbeatListener.on('error', (err) => {
  logMessage(HEARTBEATSYS," Heartbeat listener error :: " + err.toString());
});

// For each package received on the UDP socket, the following function will execute ...
heartbeatListener.on('message', (message, client) => {
    var gameServerAddr = client.address + ":" + client.port;
    var heartbeat = message.split('\\');
    if(heartbeat.length < 6){
        // So the message is like: \heartbeat\7778\gamename\ut\, which is the first step of a game server heartbeat
        knownGameServers[gameServerAddr] = new UnrealGameServer(gameSvrAddr[0], gameSvrAddr[1], heartbeat[4], 0);
        client.write("\\basic\\secure\\OPNSRC"); // Challanges the server, according to protocol...
        logMessage(HEARTBEATSYS, "Game server " + gameServerAddr + " reported in. Waiting confirmation.");
    }else if(knownGameServers[gameServerAddr] != null){
        // Second message, the final step to the hearbeat process. We ignore the challange answer and accept anything.
        // Like this: \heartbeat\7778\gamename\ut\validate\XuXkWPKC\final.
        // Renew this server life time for at least HEARTBEATTOLERANCE seconds.
        knownGameServers[gameServerAddr].auth = HEARTBEATTOLERANCE;
        logMessage(HEARTBEATSYS, "Game server " + gameServerAddr + " reported in and registered.");
    }
});

// UDP listener started event.
heartbeatListener.on('listening', () => {
  logMessage(HEARTBEATSYS, "Listening to game servers's UDP heartbeats on port " + heartbeatListener.address().port);
});

heartbeatListener.bind(UDPSERVERPORT);

// ----------------------------------------------------------------
// Bootstrap
// ----------------------------------------------------------------

setInterval(syncWithAll, SYNCTIME); // Every 40 seconds syncs with other master servers
setInterval(clearKnownGameServers, CLEARTIME); // Every 10 seconds verifies the list for game servers sending heartbeats to this
                                               // server, and clears the ones which did not respond for 
                                               // more than the HEARTBEATTOLERANCE time
logMessage("Global","Open Source Master Server instance running on port "+TCPSERVERPORT);
syncWithAll(); // Syncs with other master servers immediatly