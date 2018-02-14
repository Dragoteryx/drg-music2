"use strict";

// IMPORTS
const discord = require("discord.js");
const ytdl = require("ytdl-core");
const fs = require("fs");
const mm = require("musicmetadata");
const youtubeSearch = require("youtube-search");

const EventEmitter = require("events");

// GLOBALS

// UTIL FUNCTIONS
function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function enumerate(proto) {
	for (let property of Object.getOwnPropertyNames(proto)) {
		if (property !== "constructor" && property != "inspect") Object.defineProperty(proto, property, {enumerable: true});
	}
}

// FUNCTIONS

function videoWebsite(str) {
	if (str.startsWith("https://www.youtube.com/watch?v=") || str.startsWith("https://youtu.be/"))
		return "Youtube";
	/*else if (str.startsWith("https://soundcloud.com/"))
		return "Soundcloud";
	else if (str.startsWith("http://www.dailymotion.com/video/") || str.startsWith("http://dai.ly/"))
		return "Dailymotion";
	else if (str.startsWith("http://www.nicovideo.jp/watch/") || str.startsWith("http://nico.ms/"))
		return "NicoNicoVideo";*/
	else return undefined;
}

function playYoutube(voiceConnection, link, passes) {
	return voiceConnection.playStream(ytdl(link, {filter:"audioonly"}), {passes: passes, bitrate:"auto"});
}

function queryYoutube(query, apiKey) {
	return new Promise((resolve, reject) => {
		youtubeSearch(query, {key: apiKey, maxResults: 1, type: "video"}, (err, res) => {
			if (err) reject(err);
			else if (res[0] !== undefined)
				resolve(res.shift().link);
			else
				resolve(undefined);
		});
	});
}

function youtubeInfo(link) {
	return new Promise((resolve, reject) => {
		ytdl.getInfo(link).then(info => {
			resolve(Object.freeze({
				title: info.title,
				link: link,
				description: info.description,
				author: {
					name: info.author.name,
					avatarURL: info.author.avatar,
					channelURL: info.author.channel_url
				},
				thumbnailURL: info.thumbnail_url,
				maxResThumbnailURL: info.thumbnail_url.replace("default.jpg", "maxresdefault.jpg"),
				length: Number(info.length_seconds)*1000,
				keywords: info.keywords
			}));
		}).catch(err => {
			reject(err);
		});
	});
}

function fileInfo(path) {
	return new Promise((resolve, reject) => {
		let readableStream = fs.createReadStream(path);
		let parser = mm(readableStream, {duration: true, fileSize: fs.statSync(path).size}, (err, metadata) => {
		  if (err) reject(err);
			else {
				readableStream.close();
				resolve(metadata);
			}
		});

	});
}

const pls = new Map();
function getPlaylist(guild, client) {
	let bool = false;
	if (!pls.has(guild.id)) {
		pls.set(guild.id, new InternalPlaylist(guild, client));
		bool = true;
	}
	return {pl: pls.get(guild.id), first: bool};
}

const weakmapPrivates = new WeakMap();
function prv(object) {
	if (!weakmapPrivates.has(object))
		weakmapPrivates.set(object, {});
	return weakmapPrivates.get(object);
}

//CLASSES
class MusicError extends Error {
	constructor(message) {
		super(message);
	}
}

class DeprecationWarning extends Error {
	constructor(message) {
		super(message);
	}
}

class MusicHandler extends EventEmitter {

	constructor(client) {
		super();
		let that = prv(this);
		that.ready = new Map();
		if (client === undefined)
			throw new Error("parameter 'client' is undefined");
		if (!(client instanceof discord.Client))
			throw new TypeError("'client' must be a Discord Client");
		if (client.musicHandler !== undefined)
			throw new Error("a Discord Client can't be linked to more than one MusicHandler");
		client.musicHandler = this;
		client.on("voiceStateUpdate", (oldMember, newMember) => {
			if (!this.isConnected(oldMember.guild))
				return;
			let musicChannel = oldMember.guild.me.voiceChannel;
			if (oldMember.user.id == client.user.id) {
				if (that.ready.has(oldMember.guild.id))
					this.emit("clientMove", oldMember.voiceChannel, newMember.voiceChannel);
			} else {
				try {
					if (oldMember.voiceChannel === undefined && newMember.voiceChannel.id == musicChannel.id)
						this.emit("memberJoin", newMember, newMember.voiceChannel);
				} catch(err) {null}
				try {
					if (oldMember.voiceChannel.id != musicChannel.id && newMember.voiceChannel.id == musicChannel.id)
						this.emit("memberJoin", newMember, newMember.voiceChannel);
				} catch(err) {null}
				try {
					if (oldMember.voiceChannel.id == musicChannel.id && newMember.voiceChannel === undefined)
						this.emit("memberLeave", newMember, oldMember.voiceChannel);
				} catch(err) {null}
				try {
					if (oldMember.voiceChannel.id == musicChannel.id && newMember.voiceChannel.id != musicChannel.id)
						this.emit("memberLeave", newMember, oldMember.voiceChannel);
				} catch(err) {null}
			}
		});
		that.playlists = new Map();
		this.client = client;
		Object.defineProperty(this, "client", {writable: false});
	}
	get guilds() {
		let guilds = new discord.Collection();
		let that = prv(this);
		let ids = Array.from(that.playlists.keys());
		for (let id of ids)
			guilds.set(id, that.playlists.get(id).guild);
		return guilds;
	}
	get channels() {
		let guilds = this.guilds;
		let channels = new discord.Collection();
		for (let guild of guilds) {
			let channel = guild[1].me.voiceChannel;
			channels.set(channel.id, channel);
		}
		return channels;
	}
	get playlists() {
		let playlists = new discord.Collection();
		let that = prv(this);
		let ids = Array.from(that.playlists.keys());
		for (let id of ids)
			playlists.set(id, that.playlists.get(id).playlist.simplified);
		return playlists;
	}
	join(tojoin) {
		let that = prv(this);
		return new Promise((resolve, reject) => {
			if (tojoin === undefined) reject(new Error("parameter 'tojoin' is undefined"));
			let voiceChannel;
			if (tojoin instanceof discord.GuildMember)
				voiceChannel = tojoin.voiceChannel
			else if (tojoin instanceof discord.VoiceChannel)
				voiceChannel = tojoin;
			else
				reject(new TypeError("'tojoin' must be a Discord GuildMember or VoiceChannel"));
			if (voiceChannel === undefined) reject(new MusicError("this member is not in a voice channel"));
			else if (this.isConnected(voiceChannel.guild)) reject(new MusicError("the client already joined a voice channel in this guild"));
			else if (!voiceChannel.joinable) reject(new MusicError("the client can't join this voice channel"));
			else if (!voiceChannel.speakable) reject(new MusicError("the client is not authorized to speak in this channel"));
			else if (voiceChannel.full) reject(new MusicError("this voice channel is full"));
			else {
				let playlist = getPlaylist(tojoin.guild, this.client);
				playlist.pl.handler = this;
				playlist.pl.joinedAt = new Date();
				playlist.pl.leaving = false;
				voiceChannel.guild.playlist = playlist.pl.simplified;
				that.playlists.set(voiceChannel.guild.id, {playlist: playlist.pl, guild: voiceChannel.guild});
				if (playlist.first) {
					playlist.pl.on("start", (guild, music) => {
						this.emit("start", playlist.pl.simplified, music);
					});
					playlist.pl.on("next", (guild, music) => {
						this.emit("next", playlist.pl.simplified, music);
					});
					playlist.pl.on("empty", guild => {
						this.emit("empty", playlist.pl.simplified);
					});
					playlist.pl.on("end", (guild, music) => {
						this.emit("end", playlist.pl.simplified, music);
					});
				}
				let joinPromise = voiceChannel.join();
				joinPromise.then(() => {
					that.ready.set(tojoin.guild.id, true);
				});
				resolve(joinPromise);
			}
		});
	}
	leave(guild) {
		let that = prv(this);
		return new Promise((resolve, reject) => {
			if (guild === undefined) reject(new Error("parameter 'guild' is undefined"));
			else if (!(guild instanceof discord.Guild)) reject(new TypeError("'guild' must be a Discord Guild"));
			else if (!this.isConnected(guild)) reject(new MusicError("the client is not in a voice channel"));
			else {
				that.playlists.get(guild.id).playlist.leaving = true;
				that.playlists.get(guild.id).playlist.reset();
				that.playlists.delete(guild.id);
				that.ready.delete(guild.id);
				guild.me.voiceChannel.leave();
				resolve();
			}
		});
	}
	add(request, member, options) {
		let that = prv(this);
		return new Promise((resolve, reject) => {
			if (request === undefined) reject(new Error("parameter 'request' is undefined"));
			else if (typeof request != "string") reject(new TypeError("'guild' must be a String"));
			else if (member === undefined) reject(new Error("parameter 'member' is undefined"));
			else if (!(member instanceof discord.GuildMember)) reject(new TypeError("'member' must be a Discord GuildMember"));
      else if (!this.isConnected(member.guild)) reject(new MusicError("the client is not in a voice channel"));
			else {
		    if (options === undefined) options = {};
		    if (options.type === undefined) options.type = "link";
		    if (options.passes === undefined) options.passes = 1;
		    if (options.type == "link") {
					let website = videoWebsite(request);
					if (website === undefined) reject(new MusicError("this website is not supported"));
					else if (website == "Youtube") {
						youtubeInfo(request).then(info => {
							let music = new Music(request, member, options.passes, false);
			        music.title = info.title;
							music.description = info.description;
							music.author = {
								name: info.author.name,
								avatarURL: info.author.avatarURL,
								channelURL: info.author.channelURL
							}
							music.thumbnailURL = info.thumbnailURL;
							music.length = info.length;
							music.keywords = info.keywords;
			        if (options.props !== undefined)
								music.props = options.props;
							that.playlists.get(member.guild.id).playlist.addMusic(music);
							resolve(music.info);
						}).catch(err => {
							if (err.message.includes("TypeError: Video id (") && err.message.includes(") does not match expected format (/^[a-zA-Z0-9-_]{11}$/)"))
								reject(new MusicError("this Youtube link is invalid"));
							else if (err.message == "This video is unavailable.")
								reject(new MusicError("this video is unavailable"));
							else
								reject(err);
						});
					}
		    } else if (options.type == "ytquery") {
					if (options.apiKey === undefined) reject(new Error("parameter 'options.apiKey' is undefined"));
					else if (typeof options.apiKey != "string") reject(new TypeError("'options.apiKey' must be a String"));
					else {
						queryYoutube(request, options.apiKey).then(link => {
							if (link === undefined) reject(new MusicError("no query results"));
							else {
								options.type = "link";
								resolve(this.addMusic(link, member, options));
							}
						}).catch(reject);
					}
		    } else if (options.type == "file") {
					fileInfo(request).then(info => {
						let music = new Music(request, member, options.passes, true);
						music.length = Math.round(info.duration*1000);
						if (options.props !== undefined)
							music.props = options.props;
						that.playlists.get(member.guild.id).playlist.addMusic(music);
						resolve(music.info);
					}).catch(reject);
		    } else reject(new MusicError("options.type => '" + options.type + "' is not a valid option ('link', 'ytquery' or 'file')"));
			}
		});
	}
	remove(guild, index) {
		let that = prv(this);
		return new Promise((resolve, reject) => {
			if (guild === undefined) reject(new Error("parameter 'guild' is undefined"));
			else if (!(guild instanceof discord.Guild)) reject(new TypeError("'guild' must be a Discord Guild"));
			else if (index === undefined) reject(new Error("parameter 'index' is undefined"));
			else if (typeof index != "number") reject(new TypeError("'guild' must be a Number"));
			else if (!this.isConnected(guild)) reject(new MusicError("the client is not in a voice channel"));
			else if (!this.isPlaying(guild)) reject(new MusicError("the client is not playing"));
			else if (index < 0) reject(new MusicError("invalid music index"));
			else if (index >= that.playlists.get(guild.id).playlist.list.length) reject(new MusicError("invalid music index"));
			else resolve(that.playlists.get(guild.id).playlist.list.splice(index, 1)[0].info);
		});
	}
	playNext(guild) {
		let that = prv(this);
		return new Promise((resolve, reject) => {
			if (guild === undefined) reject(new Error("parameter 'guild' is undefined"));
			else if (!(guild instanceof discord.Guild)) reject(new TypeError("'guild' must be a Discord Guild"));
			else if (!this.isConnected(guild)) reject(new MusicError("the client is not in a voice channel"));
			else if (!this.isPlaying(guild)) reject(new MusicError("the client is not playing"));
			else {
				let current = this.currentInfo(guild);
				that.playlists.get(guild.id).playlist.looping = false;
				that.playlists.get(guild.id).playlist.paused = false;
				that.playlists.get(guild.id).playlist.dispatcher.end("playnext");
				resolve(current);
			}
		});
	}
	skip(guild) {
		return this.playNext(guild);
	}
	clear(guild) {
		let that = prv(this);
		return new Promise((resolve, reject) => {
			if (guild === undefined) reject(new Error("parameter 'guild' is undefined"));
			else if (!(guild instanceof discord.Guild)) reject(new TypeError("'guild' must be a Discord Guild"));
			else if (!this.isConnected(guild)) reject(new MusicError("the client is not in a voice channel"));
			else if (!this.isPlaying(guild)) reject(new MusicError("the client is not playing"));
			else {
				let nb = that.playlists.get(guild.id).playlist.list.length;
				that.playlists.get(guild.id).playlist.list = [];
				resolve(nb);
			}
		});
	}
	shuffle(guild) {
		let that = prv(this);
		return new Promise((resolve, reject) => {
			if (guild === undefined) reject(new Error("parameter 'guild' is undefined"));
			else if (!(guild instanceof discord.Guild)) reject(new TypeError("'guild' must be a Discord Guild"));
			else if (!this.isConnected(guild)) reject(new MusicError("the client is not in a voice channel"));
			else if (!this.isPlaying(guild)) reject(new MusicError("the client is not playing"));
			else if (that.playlists.get(guild.id).playlist.list.length == 0) reject(new MusicError("the playlist is empty"));
			else {
				that.playlists.get(guild.id).playlist.list.sort(() => Math.random() - 0.5);
				resolve();
			}
		});
	}
	resume(guild) {
		let that = prv(this);
		return new Promise((resolve, reject) => {
			if (guild === undefined) reject(new Error("parameter 'guild' is undefined"));
			else if (!(guild instanceof discord.Guild)) reject(new TypeError("'guild' must be a Discord Guild"));
			else if (!this.isConnected(guild)) reject(new MusicError("the client is not in a voice channel"));
			else if (!this.isPlaying(guild)) reject(new MusicError("the client is not playing"));
			else if (!this.isPaused(guild)) reject(new MusicError("musicNotPaused"));
			else {
				that.playlists.get(guild.id).playlist.dispatcher.resume();
				that.playlists.get(guild.id).playlist.paused = false;
				resolve(that.playlists.get(guild.id).playlist.current.info);
			}
		});
	}
	pause(guild) {
		let that = prv(this);
		return new Promise((resolve, reject) => {
			if (guild === undefined) reject(new Error("parameter 'guild' is undefined"));
			else if (!(guild instanceof discord.Guild)) reject(new TypeError("'guild' must be a Discord Guild"));
			else if (!this.isConnected(guild)) reject(new MusicError("the client is not in a voice channel"));
			else if (!this.isPlaying(guild)) reject(new MusicError("the client is not playing"));
			else if (this.isPaused(guild)) reject(new MusicError("musicAlreadyPaused"));
			else {
				that.playlists.get(guild.id).playlist.dispatcher.pause();
				that.playlists.get(guild.id).playlist.paused = true;
				resolve(that.playlists.get(guild.id).playlist.current.info);
			}
		});
	}
	togglePaused(guild) {
		let that = prv(this);
		return new Promise((resolve, reject) => {
			if (guild === undefined) reject(new Error("parameter 'guild' is undefined"));
			else if (!(guild instanceof discord.Guild)) reject(new TypeError("'guild' must be a Discord Guild"));
			else if (!this.isConnected(guild)) reject(new MusicError("the client is not in a voice channel"));
			else if (!this.isPlaying(guild)) reject(new MusicError("the client is not playing"));
			else {
				that.playlists.get(guild.id).playlist.paused = !that.playlists.get(guild.id).playlist.paused;
				if (that.playlists.get(guild.id).playlist.paused)
					that.playlists.get(guild.id).playlist.dispatcher.pause();
				else
					that.playlists.get(guild.id).playlist.dispatcher.resume();
				resolve(that.playlists.get(guild.id).playlist.paused);
			}
		});
	}
	toggleLooping(guild) {
		let that = prv(this);
		return new Promise((resolve, reject) => {
			if (guild === undefined) reject(new Error("parameter 'guild' is undefined"));
			else if (!(guild instanceof discord.Guild)) reject(new TypeError("'guild' must be a Discord Guild"));
			else if (!this.isConnected(guild)) reject(new MusicError("the client is not in a voice channel"));
			else if (!this.isPlaying(guild)) reject(new MusicError("the client is not playing"));
			else {
				let playlist = that.playlists.get(guild.id).playlist;
				playlist.pllooping = false;
				playlist.looping = !playlist.looping;
				resolve(playlist.looping);
			}
		});
	}
	togglePlaylistLooping(guild) {
		let that = prv(this);
		return new Promise((resolve, reject) => {
			if (guild === undefined) reject(new Error("parameter 'guild' is undefined"));
			else if (!(guild instanceof discord.Guild)) reject(new TypeError("'guild' must be a Discord Guild"));
			else if (!this.isConnected(guild)) reject(new MusicError("the client is not in a voice channel"));
			else {
				let playlist = that.playlists.get(guild.id).playlist;
				playlist.looping = false;
				playlist.pllooping = !playlist.pllooping;
				resolve(playlist.pllooping);
			}
		});
	}
	setVolume(guild, volume) {
		let that = prv(this);
		return new Promise((resolve, reject) => {
			if (guild === undefined) reject(new Error("parameter 'guild' is undefined"));
			else if (!(guild instanceof discord.Guild)) reject(new TypeError("'guild' must be a Discord Guild"));
			else if (volume === undefined) reject(new Error("parameter 'volume' is undefined"));
			else if (typeof volume != "number") reject(new TypeError("'volume' must be a Number"));
			else if (!this.isConnected(guild)) reject(new MusicError("the client is not in a voice channel"));
			else if (volume < 0) reject(new MusicError("volume < 0"));
			else {
				let old = this.getVolume(guild);
				that.playlists.get(guild.id).playlist.volume = volume;
				if (this.isPlaying(guild))
					that.playlists.get(guild.id).playlist.dispatcher.setVolume(volume/100.0);
				resolve(old);
			}
		});
	}

	//------------
	isConnected(guild) {
		if (guild === undefined) throw new Error("parameter 'guild' is undefined");
		else if (!(guild instanceof discord.Guild)) throw new TypeError("'guild' must be a Discord Guild");
		return prv(this).playlists.has(guild.id);
	}
	isPlaying(guild) {
		let that = prv(this);
		if (guild === undefined) throw new Error("parameter 'guild' is undefined");
		if (!(guild instanceof discord.Guild)) throw new TypeError("'guild' must be a Discord Guild");
		if (!this.isConnected(guild))
			return false;
		return that.playlists.get(guild.id).playlist.playing;
	}
	isPaused(guild) {
		let that = prv(this);
		if (guild === undefined) throw new Error("parameter 'guild' is undefined");
		if (!(guild instanceof discord.Guild)) throw new TypeError("'guild' must be a Discord Guild");
		if (!this.isPlaying(guild))
			return false;
		return that.playlists.get(guild.id).playlist.paused;
	}
	isLooping(guild) {
		let that = prv(this);
		if (guild === undefined) throw new Error("parameter 'guild' is undefined");
		if (!(guild instanceof discord.Guild)) throw new TypeError("'guild' must be a Discord Guild");
		if (!this.isPlaying(guild))
			return false;
		return that.playlists.get(guild.id).playlist.looping;
	}
	isPlaylistLooping(guild) {
		let that = prv(this);
		if (guild === undefined) throw new Error("parameter 'guild' is undefined");
		if (!(guild instanceof discord.Guild)) throw new TypeError("'guild' must be a Discord Guild");
		if (!this.isConnected(guild))
			return false;
		return that.playlists.get(guild.id).playlist.pllooping;
	}
	currentInfo(guild) {
		let that = prv(this);
		if (guild === undefined) throw new Error("parameter 'guild' is undefined");
		if (!(guild instanceof discord.Guild)) throw new TypeError("'guild' must be a Discord Guild");
		if (!this.isConnected(guild)) return undefined;
		if (!this.isPlaying(guild)) return null;
		let info = Object.assign({}, that.playlists.get(guild.id).playlist.current.info);
		info.time = that.playlists.get(guild.id).playlist.dispatcher.time;
		return Object.freeze(info);
	}
	playlistInfo(guild) {
		let that = prv(this);
		if (guild === undefined) throw new Error("parameter 'guild' is undefined");
		if (!(guild instanceof discord.Guild)) throw new TypeError("'guild' must be a Discord Guild");
		if (!this.isConnected(guild)) return undefined;
		let tab = [];
		for (let music of that.playlists.get(guild.id).playlist.list)
			tab.push(music.info);
		return tab;
	}
	getVolume(guild) {
		let that = prv(this);
		if (guild === undefined) throw new Error("parameter 'guild' is undefined");
		if (!(guild instanceof discord.Guild)) throw new TypeError("'guild' must be a Discord Guild");
		if (!this.isConnected(guild)) return undefined;
		return that.playlists.get(guild.id).playlist.volume;
	}
	inspect() {
		return {
			client: this.client,
			guilds: this.guilds,
			channels: this.channels,
			playlists: this.playlists
		}
	}
}



class Playlist {
	constructor(playlist) {
		prv(this).playlist = playlist;
		this.guild = prv(this).playlist.guild;
		this.firstJoinedAt = playlist.joinedAt;
		this.firstJoinedTimestamp = this.firstJoinedAt.getTime();
		Object.defineProperty(this, "guild", {writable: false});
		Object.defineProperty(this, "firstJoinedAt", {writable: false});
		Object.defineProperty(this, "firstJoinedTimestamp", {writable: false});
	}
	get channel() {
		return this.guild.me.voiceChannel;
	}
	get lastJoinedAt() {
		return prv(this).playlist.joinedAt;
	}
	get lastJoinedTimestamp() {
		return this.lastJoinedAt.getTime();
	}
	get connected() {
		return prv(this).playlist.handler.isConnected(this.guild);
	}
	get playing() {
		return prv(this).playlist.handler.isPlaying(this.guild);
	}
	get paused() {
		return prv(this).playlist.handler.isPaused(this.guild);
	}
	set paused(paused) {
		if (paused)
			prv(this).playlist.handler.pause(this.guild).catch(console.error);
		else
			prv(this).playlist.handler.resume(this.guild).catch(console.error);
	}
	get looping() {
		return prv(this).playlist.handler.isLooping(this.guild);
	}
	set looping(looping) {
		if (this.playing && typeof looping == "boolean") {
			if (looping)
				prv(this).playlist.pllooping = false;
			prv(this).playlist.looping = looping;
		}
	}
	get playlistLooping() {
		return prv(this).playlist.handler.isPlaylistLooping(this.guild);
	}
	set playlistLooping(pllooping) {
		if (this.connected && typeof pllooping == "boolean") {
			if (pllooping)
				prv(this).playlist.looping = false;
			prv(this).playlist.pllooping = pllooping;
		}
	}
	get current() {
		return prv(this).playlist.handler.currentInfo(this.guild);
	}
	get info() {
		return prv(this).playlist.handler.playlistInfo(this.guild);
	}
	get volume() {
		return prv(this).playlist.handler.getVolume(this.guild);
	}
	set volume(newv) {
		prv(this).playlist.handler.setVolume(this.guild, newv).catch(console.error);
	}
	join(tojoin) {
		return prv(this).playlist.handler.join(tojoin);
	}
	leave() {
		return prv(this).playlist.handler.leave(this.guild);
	}
	add(request, member, options) {
		return prv(this).playlist.handler.add(request, member, options);
	}
	remove(index) {
		return prv(this).playlist.handler.remove(this.guild, index);
	}
	playNext() {
		return prv(this).playlist.handler.playNext(this.guild);
	}
	skip() {
		return this.playNext();
	}
	clear() {
		return prv(this).playlist.handler.clearPlaylist(this.guild);
	}
	shuffle() {
		return prv(this).playlist.handler.shufflePlaylist(this.guild);
	}
	inspect() {
		return {
			guild: this.guild,
			channel: this.channel,
			firstJoinedAt: this.firstJoinedAt,
			firstJoinedTimestamp: this.firstJoinedTimestamp,
			lastJoinedAt: this.lastJoinedAt,
			lastJoinedTimestamp: this.lastJoinedTimestamp,
			connected: this.connected,
			playing: this.playing,
			paused: this.paused,
			looping: this.looping,
			playlistLooping: this.playlistLooping,
			current: this.current,
			info: this.info,
			volume: this.volume
		}
	}
}

class InternalPlaylist extends EventEmitter {
	constructor(guild, client) {
		super();
		this.guild = guild;
		this.client = client;
		this.list = [];
		this.playing = false;
		this.paused = false;
		this.looping = false;
		this.pllooping = false;
		this.volume = 100;
		this.leaving = false;
		this.joinedAt = new Date();
		this.simplified = new Playlist(this);
	}
	async addMusic(music) {
		music._playlist = this;
		this.list.push(music);
		await sleep(500);
		if (!this.playing)
			this.playNext();
	}
	playNext() {
		if (!this.looping)
			this.current = this.list.shift();
		if (this.current !== undefined) {
			this.dispatcher = this.current.play();
			this.playing = true;
			this.dispatcher.setVolume(this.volume/100.0);
			this.dispatcher.once("start", () => {
				if (!this.leaving) this.emit("start", this.guild, this.current.info);
			});
			this.dispatcher.once("end", async () => {
				await sleep(500);
				if (this.pllooping)
					this.list.push(this.current);
				if (!this.leaving) this.emit("end", this.guild, this.current.info);
				this.playNext();
			});
			if (!this.looping)
				if (!this.leaving) this.emit("next", this.guild, this.current.info);
		} else {
			this.reset();
			if (!this.leaving) this.emit("empty", this.guild);
		}
	}
	reset() {
		if (this.dispatcher !== undefined)
			this.dispatcher.end("killing playlist");
		this.dispatcher = undefined;
		this.playing = false;
		this.paused = false;
		this.current = undefined;
		this.looping = false;
		this.pllooping = false;
	}
}

class Music {
	constructor(link, member, passes, file) {
		this.link = link;
		if (file) {
			this.title = this.link.split("/").pop();
			this.length = 0;
		} else this.website = videoWebsite(this.link);
		this.member = member;
		this.passes = passes;
		this.file = file;
	}
	play() {
		if (!this.file) {
			if (this.website == "Youtube")
				return playYoutube(this.member.guild.voiceConnection, this.link, this.passes);
			else if (this.website == "Soundcloud")
				return playSoundcloud(this.member.guild.voiceConnection, this.link, this.passes);
		}
		else
			return this.member.guild.voiceConnection.playFile(this.link, {passes: this.passes, bitrate: "auto"});
	}
	get playlist() {
		return this._playlist.simplified;
	}
	get info() {
		if (!this.file) {
			if (this.website == "Youtube") {
				return Object.freeze({
					title: this.title,
					link: this.link,
					description: this.description,
					author: Object.freeze(this.author),
					thumbnailURL: this.thumbnailURL,
					maxResThumbnailURL: this.thumbnailURL.replace("default.jpg", "maxresdefault.jpg"),
					length: this.length,
					time: 0,
					keywords: Object.freeze(this.keywords),
					file: false,
					website: "Youtube",
					member: this.member,
					props: Object.freeze(this.props),
					playlist: this.playlist
				});
			}
		} else {
			return Object.freeze({
				title: this.title,
				path: this.link,
				length: this.length,
				time: 0,
				file: true,
				member: this.member,
				props: this.props,
				playlist: this.playlist
			});
		}
	}
}

// MODULES
MusicHandler.videoWebsite = videoWebsite;
MusicHandler.playYoutube = playYoutube;
MusicHandler.youtubeInfo = youtubeInfo;
MusicHandler.queryYoutube = queryYoutube;
enumerate(MusicHandler.prototype);
enumerate(Playlist.prototype);
module.exports = MusicHandler;
