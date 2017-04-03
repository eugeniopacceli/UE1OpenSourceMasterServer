# UE1OpenSourceMasthttps://github.com/eugeniopacceli/UE1OpenSourceMasterServer/blob/master/UE1OpenSourceMasterServer.jserServer
An open source centralized masterserver (using Node.js) for old games using GameSpy v1 network protocol.

This server:
* Logs all network activities
* Listens to game servers heartbeats and register their info periodically
* Queries other known master servers for their game servers lists, completing it's own, from time to time
* Accepts client requests and sends the full currently known game servers list

Knowledge used:
* [Node.js v7.8.0 Documentation - Net (TCP protocol)](https://nodejs.org/api/net.html)
* [Node.js v7.8.0 Documentation - UDP / Datagram Sockets](https://nodejs.org/api/dgram.html)
* [333networks Wiki - Gamespy v1 protocol](http://wiki.333networks.com/index.php/Gamespy_v1_protocol)
* [333networks Wiki - MasterServer](http://wiki.333networks.com/index.php/MasterServer)

To be done:
* Implement a functionallity to identify other masterservers running a instance of this code, so a better synchronization can be negociated.
* Implement the security challanges functionalities - currently accepting anything, works with the game title DeusEx (2000)
* Further tests

Tested locally with DeusEx (2000) and it's more popular masterservers.

To test this:
Install [Node.js](https://nodejs.org/en/), run 'node UE1OpenSourceMasterServer.js'

Use it as it pleases you (studying, improving on it, hosting it, using locally, etc)!
