# drg-music2
![Drg Music 2](https://nodei.co/npm/drg-music2.png?downloads=true&stars=true)


A single file module to easily manage music players using Discord.js.

## How to use ?
You need to create a new MusicHandler.
```js
const discord = require("discord.js");
const client = new discord.Client();

const MusicHandler = require("drg-music2");
const music = new MusicHandler(client);
```

Then, you'll need to interact with the MusicHandler you just created.

## Classes
This module lets you interact with 2 different classes.

### MusicHandler extends [EventEmitter](https://nodejs.org/dist/latest/docs/api/events.html#events_class_eventemitter)
This is the main class.

#### Attributes
##### MusicHandler.client (read-only)
The [Client](https://discord.js.org/#/docs/main/stable/class/Client) used to initialize this MusicHandler.

##### MusicHandler.prototype.guilds (getter)
A [Collection](https://discord.js.org/#/docs/main/stable/class/Collection) containing all [Guild](https://discord.js.org/#/docs/main/stable/class/Guild)s joined by the bot, mapped by their ID.

##### MusicHandler.prototype.playlists (getter)
A [Collection](https://discord.js.org/#/docs/main/stable/class/Collection) containing all Playlists, mapped by the corresponding Guild ID.

#### Methods
##### MusicHandler.prototype.join
```js
music.join(toJoin);
```
``toJoin``: [GuildMember](https://discord.js.org/#/docs/main/stable/class/GuildMember) or [VoiceChannel](https://discord.js.org/#/docs/main/stable/class/VoiceChannel) to join

Returns: [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)<[VoiceConnection](https://discord.js.org/#/docs/main/stable/class/VoiceConnection)>

#### Static methods
Currently redacting.

### Playlist
Currently redacting.

#### Attributes
Currently redacting.

#### Methods
Currently redacting.
