# drg-music2
![Drg Music 2](https://nodei.co/npm/drg-music2.png?downloads=true&stars=true)


A simple to use framework to create and manage music playlists for Discord using [discord.js](https://github.com/discordjs/discord.js).

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
* **client** (read-only)
  <br>The [Client](https://discord.js.org/#/docs/main/stable/class/Client) used to initialize this MusicHandler.

* **guilds**
  <br>A [Collection](https://discord.js.org/#/docs/main/stable/class/Collection) containing all [Guild](https://discord.js.org/#/docs/main/stable/class/Guild)s where the [Client](https://discord.js.org/#/docs/main/stable/class/Client) is currently playing music, mapped by their ID.

* **channels**
  <br>A [Collection](https://discord.js.org/#/docs/main/stable/class/Collection) containing all [Guild](https://discord.js.org/#/docs/main/stable/class/Guild)s where the [Client](https://discord.js.org/#/docs/main/stable/class/Client) is currently playing music, mapped by their ID.

* **playlists**
  <br>A [Collection](https://discord.js.org/#/docs/main/stable/class/Collection) containing all Playlists from the [Guild](https://discord.js.org/#/docs/main/stable/class/Guild)s where the [Client](https://discord.js.org/#/docs/main/stable/class/Client) is currently playing music, , mapped by the corresponding ID.

#### Methods
* **join**
  ```js
  music.join(tojoin);
  ```
  ``tojoin``: the [GuildMember](https://discord.js.org/#/docs/main/stable/class/GuildMember) or [VoiceChannel](https://discord.js.org/#/docs/main/stable/class/VoiceChannel) to join

  Returns: [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)<[VoiceConnection](https://discord.js.org/#/docs/main/stable/class/VoiceConnection)>

* **leave**
  ```js
  music.leave(guild);
  ```
  ``guild``: the [Guild](https://discord.js.org/#/docs/main/stable/class/Guild) to leave

  Returns: [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)

* **add**
  ```js
  music.add(request, member, options);
  ```
  ``request``: Youtube link/Youtube query/path to a local file
  <br>``member``: the [GuildMember](https://discord.js.org/#/docs/main/stable/class/GuildMember) who requested the music
  <br>``options`` is optional
  <br>``options.type``: 'link', 'ytquery' or 'file'
  <br>``options.passes``: how many times to send the voice packet to reduce packet loss

  Returns: [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<MusicInfo (added music)\>

* **remove**
  ```js
  music.remove(guild, index);
  ```
  ``guild``: [Guild](https://discord.js.org/#/docs/main/stable/class/Guild)
  <br>``index``: the index of the music in the playlist (starting at 0)

  Returns: [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<MusicInfo (removed music)\>

* **playNext**

* **skip**
  <br>Alias for **playNext**

* **clear**

* **shuffle**

* **resume**

* **pause**

* **togglePaused**

* **toggleLooping**

* **togglePlaylistLooping**

* **getVolume**

* **setVolume**

* **isConnected**

* **isPlaying**

* **isPaused**

* **isLooping**

* **isPlaylistLooping**

* **currentInfo**

* **playlistInfo**

#### Static methods
* **videoWebsite**

* **playYoutube**

* **youtubeInfo**

* **queryYoutube**

#### Events
*  ``clientMove``: emitted when the [Client](https://discord.js.org/#/docs/main/stable/class/Client) that instantiated this MusicHandler moves from one [VoiceChannel](https://discord.js.org/#/docs/main/stable/class/VoiceChannel) to another
  <br>Returns: old [VoiceChannel](https://discord.js.org/#/docs/main/stable/class/VoiceChannel) and new [VoiceChannel](https://discord.js.org/#/docs/main/stable/class/VoiceChannel)

* ``memberJoin``: emitted when a [GuildMember](https://discord.js.org/#/docs/main/stable/class/GuildMember) joins a [VoiceChannel](https://discord.js.org/#/docs/main/stable/class/VoiceChannel) where the [Client](https://discord.js.org/#/docs/main/stable/class/Client) is playing music
  <br>Returns: [VoiceChannel](https://discord.js.org/#/docs/main/stable/class/) and [GuildMember](https://discord.js.org/#/docs/main/stable/class/GuildMember)

* ``memberLeave``: emitted when a [GuildMember](https://discord.js.org/#/docs/main/stable/class/GuildMember) leaves a [VoiceChannel](https://discord.js.org/#/docs/main/stable/class/VoiceChannel) where the [Client](https://discord.js.org/#/docs/main/stable/class/Client) is playing music
  <br>Returns: [VoiceChannel](https://discord.js.org/#/docs/main/stable/class/) and [GuildMember](https://discord.js.org/#/docs/main/stable/class/GuildMember)

* ``start``: emitted when the current music starts playing
  <br>Returns: Playlist and MusicInfo (current music)

* ``end``: emitted when the current music ends
  <br>Returns: Playlist and MusicInfo (current music)

* ``next``: emitted when the playlist switches to the next music
  <br>Returns: Playlist and MusicInfo (next music)

* ``empty``: emitted when switching to the next music and the playlist is empty
  <br>Returns: Playlist


### Playlist
This class does not really store information and is more of an alias but in some cases it can be useful.

#### Attributes
* **guild** (read-only)
  <br>[Guild](https://discord.js.org/#/docs/main/stable/class/Guild) represented by this Playlist

* **channel** (read-only)
  <br>[VoiceChannel](https://discord.js.org/#/docs/main/stable/class/VoiceChannel) joined by the [Client](https://discord.js.org/#/docs/main/stable/class/Client)

* **firstJoinedAt** (read-only)
  <br>[Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) representing the first time the [Client](https://discord.js.org/#/docs/main/stable/class/Client) joined a [VoiceChannel](https://discord.js.org/#/docs/main/stable/class/VoiceChannel) in this [Guild](https://discord.js.org/#/docs/main/stable/class/Guild)

* **firstJoinedTimestamp** (read-only)
  <br>Alias for **firstJoinedAt.getTime()**

* **lastJoinedAt** (read-only)
  <br>[Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) representing the last time the [Client](https://discord.js.org/#/docs/main/stable/class/Client) joined a [VoiceChannel](https://discord.js.org/#/docs/main/stable/class/VoiceChannel) in this [Guild](https://discord.js.org/#/docs/main/stable/class/Guild)

* **lastJoinedTimestamp** (read-only)
  <br>Alias for **lastJoinedAt.getTime()**

* **connected** (read-only)
  <br>Whether or not the [Client](https://discord.js.org/#/docs/main/stable/class/Client) is connected in this [Guild](https://discord.js.org/#/docs/main/stable/class/Guild)

* **playing** (read-only)
  <br>Whether or not the [Client](https://discord.js.org/#/docs/main/stable/class/Client) is currently playing music

* **paused**
  <br>Whether or not the [Client](https://discord.js.org/#/docs/main/stable/class/Client) is paused

* **looping**
  <br>Whether or not the [Client](https://discord.js.org/#/docs/main/stable/class/Client) is looping the current music

* **playlistLooping**
  <br>Whether or not the [Client](https://discord.js.org/#/docs/main/stable/class/Client) is looping the Playlist

* **current** (read-only)
  <br>Information about the current music

* **info** (read-only)
  <br>Information about all the musics in this Playlist

* **volume**
  <br>The volume at which music is played

#### Methods
Those methods are just an alias for the methods with the same name in MusicHandler, except you don't need to precise the guild as a parameter when it is required.

* **join**
  <br>Alias for **MusicHandler.prototype.join**

* **leave**
  <br>Alias for **MusicHandler.prototype.leave**

* **add**
  <br>Alias for **MusicHandler.prototype.add**

* **remove**
  <br>Alias for **MusicHandler.prototype.remove**

* **playNext**
  <br>Alias for **MusicHandler.prototype.playNext**

* **skip**
  <br>Alias for **MusicHandler.prototype.skip**

* **clear**
  <br>Alias for **MusicHandler.prototype.clear**

* **shuffle**
  <br>Alias for **MusicHandler.prototype.shuffle**

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
    music.add(youtubeLink, message.member).then(added => {
      message.reply(added.title + " has been added to the playlist!");
    }).catch(console.error);
  }

});

client.login("MYAWESOMEBOTTOKEN");
```
