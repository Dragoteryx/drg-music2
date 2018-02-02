# drg-music2
![Drg Music 2](https://nodei.co/npm/drg-music2.png?downloads=true&stars=true)

A single file module to easily manage music players using Discord.js.

## How to use ?
You need to create a new MusicHandler.
```js
const MusicHandler = require("drg-music");
const music = new MusicHandler(client);
```
``client`` represents your Discord.js client (your bot).

Then, you'll need to interact with the MusicHandler you just created.

## Classes
This module lets you interact with 2 different classes.

### MusicHandler
This is the main class. You only to create one.

#### Attributes
##### MusicHandler.prototype.client (read-only)
The Discord.js Client used to initialize this MusicHandler.

##### MusicHandler.prototype.guilds (read-only)
A Discord.js Collection containing all guilds joined by the bot, mapped by their ID.

##### MusicHandler.prototype.playlists (read-only)
A Discord.js Collection containing all playlists, mapped by the corresponding Guild ID.

Currently redacting.

#### Methods
Currently redacting.

#### Static methods
Currently redacting.

### Playlist
Currently redacting.

#### Attributes
Currently redacting.

#### Methods
Currently redacting.
