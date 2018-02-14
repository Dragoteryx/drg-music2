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
* **MusicHandler.client** (read-only)
  <br>The [Client](https://discord.js.org/#/docs/main/stable/class/Client) used to initialize this MusicHandler.

* **MusicHandler.prototype.guilds** (getter)
  <br>A [Collection](https://discord.js.org/#/docs/main/stable/class/Collection) containing all [Guild](https://discord.js.org/#/docs/main/stable/class/Guild)s where the [Client](https://discord.js.org/#/docs/main/stable/class/Client) is currently playing music, mapped by their ID.

* **MusicHandler.prototype.playlists** (getter)
  <br>A [Collection](https://discord.js.org/#/docs/main/stable/class/Collection) containing all Playlists from the [Guild](https://discord.js.org/#/docs/main/stable/class/Guild)s where the [Client](https://discord.js.org/#/docs/main/stable/class/Client) is currently playing music, , mapped by the corresponding ID.

#### Methods
* **MusicHandler.prototype.join**
  <br>```js
  music.join(tojoin);
  ```
  ``tojoin``: [GuildMember](https://discord.js.org/#/docs/main/stable/class/GuildMember) or [VoiceChannel](https://discord.js.org/#/docs/main/stable/class/VoiceChannel) to join

  Returns: [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)<[VoiceConnection](https://discord.js.org/#/docs/main/stable/class/VoiceConnection)>

#### Static methods
Currently redacting.

#### Events
``clientMoved``: emitted when the [Client](https://discord.js.org/#/docs/main/stable/class/Client) that instantiated this MusicHandler moves from one [VoiceChannel](https://discord.js.org/#/docs/main/stable/class/VoiceChannel) to another
Returns: old [VoiceChannel](https://discord.js.org/#/docs/main/stable/class/VoiceChannel) and new [VoiceChannel](https://discord.js.org/#/docs/main/stable/class/VoiceChannel)
``memberJoin``:
``memberLeave``:
``start``:
``end``:
``next``:
``empty``:

### Playlist
Currently redacting.

#### Attributes
Currently redacting.

#### Methods
Currently redacting.

## Example
```js
const discord = require("discord.js");
const client = new discord.Client();

const MusicHandler = require("drg-music2");
const music = new MusicHandler(client);

client.on("message", message => {

  if (message.content == "/join") {
    if (music.isConnected(message.guild)) {
      message.reply("I am already connected!");
      return;
    }
    music.join(message.member).then(() => {
      message.reply("hello!");
    }).catch(console.error);
  }

  else if (message.content == "/leave") {
    if (!music.isConnected(message.guild)) {
      message.reply("I am not connected!");
      return;
    }
    music.leave(message.guild).then(() => {
      message.reply("bye!");
    }).catch(console.error);
  }

  else if (message.content.startsWith("/request ")) {
    if (!music.isConnected(message.guild)) {
      message.reply("I am not connected!");
      return;
    }
    let youtubeLink = message.content.replace("/request ", "");
    music.addMusic(youtubeLink, message.member).then(added => {
      message.reply(added.title + " has been added to the playlist!");
    }).catch(console.error);
  }

});

client.login("MYAWESOMEBOTTOKEN");
```
