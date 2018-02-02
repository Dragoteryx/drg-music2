"use strict";

// IMPORTS
const discord = require("discord.js");
const ytdl = require("ytdl-core");
const fs = require("fs");
const mm = require("musicmetadata");
const youtubeSearch = require("youtube-search");

const EventEmitter = require("events");

// GLOBALS

// FUNCTIONS
function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function videoWebsite(str) {
	if (str.startsWith("https://www.youtube.com/watch?v=") || str.startsWith("https://youtu.be/"))
		return "Youtube";
	/*else if (str.startsWith("https://soundcloud.com/"))
		return "Soundcloud";
	else if (str.startsWith("http://www.dailymotion.com/video/") || str.startsWith("http://dai.ly/"))
		return "Dailymotion";
	else if (str.startsWith("http://www.nicovideo.jp/watch/") || str.startsWith("http://nico.ms/"))
		return "NicoNicoVideo";*/
	else throw new MusicError("unknownOrNotSupportedVideoWebsite");
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
				reject(new Error("noResults"));
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

class MusicHandler extends EventEmitter {
	constructor(client) {
		super();
		client.music = this;
		client.on("voiceStateUpdate", (oldMember, newMember) => {
			let musicChannel = newMember.guild.me.voiceChannel;
			if (musicChannel === undefined) return;
			try {
				if (oldMember.voiceChannel === undefined && newMember.voiceChannel.id == musicChannel.id)
					this.emit("memberJoin", newMember, musicChannel);
			} catch(err) {null}
			try {
				if (oldMember.voiceChannel.id != musicChannel.id && newMember.voiceChannel.id == musicChannel.id)
					this.emit("memberJoin", newMember, musicChannel);
			} catch(err) {null}
			try {
				if (oldMember.voiceChannel.id == musicChannel.id && newMember.voiceChannel === undefined)
					this.emit("memberLeave", newMember, musicChannel);
			} catch(err) {null}
			try {
				if (oldMember.voiceChannel.id == musicChannel.id && newMember.voiceChannel.id != musicChannel.id)
					this.emit("memberLeave", newMember, musicChannel);
			} catch(err) {null}
		});
		let that = prv(this);
		that.client = client;
		that.playlists = new Map();
	}
	get client() {
		return prv(this).client;
	}
	get guilds() {
		let guilds = new discord.Collection();
		let that = prv(this);
		let ids = Array.from(that.playlists.keys());
		for (let id of ids)
			guilds.set(id, that.playlists.get(id).guild);
		return guilds;
	}
	get playlists() {
		let playlists = new discord.Collection();
		let that = prv(this);
		let ids = Array.from(that.playlists.keys());
		for (let id of ids)
			playlists.set(id, that.playlists.get(id).playlist.simplified);
		return playlists;
	}
	join(member) {
		let that = prv(this);
		return new Promise((resolve, reject) => {
			if (this.isConnected(member.guild)) reject(new MusicError("clientAlreadyInAVoiceChannel"));
			else if (member.voiceChannel === undefined) reject(new MusicError("memberNotInAVoiceChannel"));
			else if (!member.voiceChannel.joinable) reject(new MusicError("voiceChannelNotJoinable"));
			else if (!member.voiceChannel.speakable) reject(new MusicError("voiceChannelNotSpeakable"));
			else if (member.voiceChannel.full) reject(new MusicError("voiceChannelFull"));
			else {
				let playlist = new InternalPlaylist(member.guild, that.client, this);
				member.guild.playlist = playlist.simplified;
				that.playlists.set(member.guild.id, {playlist: playlist, guild: member.guild});
				that.playlists.get(member.guild.id).playlist.on("start", (guild, music) => {
					this.emit("start", that.playlists.get(member.guild.id).playlist.simplified, music);
					this.emit("start" + member.guild.id);
				});
				that.playlists.get(member.guild.id).playlist.on("next", (guild, music) => {
					this.emit("next", that.playlists.get(member.guild.id).playlist.simplified, music);
				});
				that.playlists.get(member.guild.id).playlist.on("empty", guild => {
					this.emit("empty", that.playlists.get(member.guild.id).playlist.simplified);
				});
				that.playlists.get(member.guild.id).playlist.on("end", (guild, music) => {
					this.emit("end", that.playlists.get(member.guild.id).playlist.simplified, music);
				});
				resolve(member.voiceChannel.join());
			}
		});
	}
	leave(guild) {
		let that = prv(this);
		return new Promise((resolve, reject) => {
			if (!this.isConnected(guild)) reject(new MusicError("clientNotInAVoiceChannel"));
			else {
				guild.playlist = undefined;
				that.playlists.get(guild.id).playlist.leaving = true;
				that.playlists.get(guild.id).playlist.reset();
				that.playlists.delete(guild.id);
				guild.me.voiceChannel.leave();
				resolve();
			}
		});
	}
	addMusic(request, member, options) {
		let that = prv(this);
		return new Promise((resolve, reject) => {
      if (!this.isConnected(member.guild))
				reject(new MusicError("clientNotInAVoiceChannel"));
			else {
		    if (options === undefined) options = {};
		    if (options.type === undefined) options.type = "link";
		    if (options.passes === undefined) options.passes = 1;
		    if (options.type == "link") {
					try {
						let website = videoWebsite(request);
						if (website == "Youtube") {
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
									reject(new MusicError("invalidYoutubeLink"));
								else if (err.message == "This video is unavailable.")
									reject(new MusicError("unavailableYoutubeVideo"));
								else
									reject(err)
							});
						}
					} catch(err) {
						reject(err);
					}
		    } else if (options.type == "ytquery") {
					if (options.apiKey === undefined) reject(new MusicError("to use 'ytquery' you need to specify a Youtube API Key"));
					else {
						queryYoutube(request, options.apiKey).then(link => {
							options.type = "link";
							resolve(this.addMusic(link, member, options));
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
	removeMusic(guild, index) {
		let that = prv(this);
		return new Promise((resolve, reject) => {
			if (!this.isConnected(guild)) reject(new MusicError("clientNotInAVoiceChannel"));
			else if (!this.isPlaying(guild)) reject(new MusicError("clientNotPlaying"));
			else if (index < 0) reject(new MusicError("invalidMusicIndex"));
			else if (index >= that.playlists.get(guild.id).playlist.list.length) reject(new MusicError("invalidMusicIndex"));
			else resolve(that.playlists.get(guild.id).playlist.list.splice(index, 1)[0].info);
		});
	}
	playNext(guild) {
		let that = prv(this);
		return new Promise((resolve, reject) => {
			if (!this.isConnected(guild)) reject(new MusicError("clientNotInAVoiceChannel"));
			else if (!this.isPlaying(guild)) reject(new MusicError("clientNotPlaying"));
			else {
				let current = this.currentInfo(guild);
				that.playlists.get(guild.id).playlist.looping = false;
				that.playlists.get(guild.id).playlist.paused = false;
				that.playlists.get(guild.id).playlist.dispatcher.end("playnext");
				resolve(current);
			}
		});
	}
	toggleLooping(guild) {
		let that = prv(this);
		return new Promise((resolve, reject) => {
			if (!this.isConnected(guild)) reject(new MusicError("clientNotInAVoiceChannel"));
			else if (!this.isPlaying(guild)) reject(new MusicError("clientNotPlaying"));
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
			if (!this.isConnected(guild)) reject(new MusicError("clientNotInAVoiceChannel"));
			else {
				let playlist = that.playlists.get(guild.id).playlist;
				playlist.looping = false;
				playlist.pllooping = !playlist.pllooping;
				resolve(playlist.pllooping);
			}
		});
	}
	clearPlaylist(guild) {
		let that = prv(this);
		return new Promise((resolve, reject) => {
			if (!this.isConnected(guild)) reject(new MusicError("clientNotInAVoiceChannel"));
			else if (!this.isPlaying(guild)) reject(new MusicError("clientNotPlaying"));
			else {
				let nb = that.playlists.get(guild.id).playlist.list.length;
				that.playlists.get(guild.id).playlist.list = [];
				resolve(nb);
			}
		});
	}
	shufflePlaylist(guild) {
		let that = prv(this);
		return new Promise((resolve, reject) => {
			if (!this.isConnected(guild)) reject(new MusicError("clientNotInAVoiceChannel"));
			else if (!this.isPlaying(guild)) reject(new MusicError("clientNotPlaying"));
			else if (that.playlists.get(guild.id).playlist.list.length == 0) reject(new MusicError("emptyPlaylist"));
			else {
				that.playlists.get(guild.id).playlist.list.sort(() => Math.random() - 0.5);
				resolve();
			}
		});
	}
	resume(guild) {
		let that = prv(this);
		return new Promise((resolve, reject) => {
			if (!this.isConnected(guild)) reject(new MusicError("clientNotInAVoiceChannel"));
			else if (!this.isPlaying(guild)) reject(new MusicError("clientNotPlaying"));
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
			if (!this.isConnected(guild)) reject(new MusicError("clientNotInAVoiceChannel"));
			else if (!this.isPlaying(guild)) reject(new MusicError("clientNotPlaying"));
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
			if (!this.isConnected(guild)) reject(new MusicError("clientNotInAVoiceChannel"));
			else if (!this.isPlaying(guild)) reject(new MusicError("clientNotPlaying"));
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
	setVolume(guild, volume) {
		let that = prv(this);
		return new Promise((resolve, reject) => {
			if (!this.isConnected(guild)) reject(new MusicError("clientNotInAVoiceChannel"));
			else if (volume < 0) reject(new MusicError("invalidVolume"));
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
		return prv(this).playlists.has(guild.id);
	}
	isPlaying(guild) {
		let that = prv(this);
		if (!this.isConnected(guild))
			return false;
		return that.playlists.get(guild.id).playlist.playing;
	}
	isPaused(guild) {
		let that = prv(this);
		if (!this.isPlaying(guild))
			return false;
		return that.playlists.get(guild.id).playlist.paused;
	}
	currentInfo(guild) {
		let that = prv(this);
		if (!this.isPlaying(guild)) return undefined;
		let info = Object.assign({}, that.playlists.get(guild.id).playlist.current.info);
		info.time = that.playlists.get(guild.id).playlist.dispatcher.time;
		return Object.freeze(info);
	}
	playlistInfo(guild) {
		let that = prv(this);
		if (!this.isConnected(guild)) return undefined;
		let tab = [];
		for (let music of that.playlists.get(guild.id).playlist.list)
			tab.push(music.info);
		return tab;
	}
	getVolume(guild) {
		let that = prv(this);
		if (!this.isConnected(guild)) return undefined;
		return that.playlists.get(guild.id).playlist.volume;
	}
}

class Playlist {
	constructor(handler, playlist) {
		prv(this).handler = handler;
		prv(this).playlist = playlist;
	}
	leave() {
		return prv(this).handler.leave(prv(this).playlist.guild);
	}
	addMusic(request, member, options) {
		return prv(this).handler.addMusic(request, member, options);
	}
	removeMusic(index) {
		return prv(this).handler.removeMusic(prv(this).playlist.guild, index);
	}
	get paused() {
		return prv(this).playlist.paused;
	}
	pause() {
		return prv(this).handler.pause(prv(this).playlist.guild);
	}
	resume() {
		return prv(this).handler.resume(prv(this).playlist.guild);
	}
	togglePaused() {
		return prv(this).handler.togglePaused(prv(this).playlist.guild);
	}
	clear() {
		return prv(this).handler.clearPlaylist(prv(this).playlist.guild);
	}
	shuffle() {
		return prv(this).handler.shufflePlaylist(prv(this).playlist.guild);
	}
	playNext() {
		return prv(this).handler.playNext(prv(this).playlist.guild);
	}
	get volume() {
		return prv(this).playlist.volume;
	}
	setVolume(newn) {
		return prv(this).handler.setVolume(prv(this).playlist.guild, newv);
	}
	set volume(newv) {
		this.setVolume(newn);
	}
	get looping() {
		return prv(this).playlist.looping;
	}
	get playlistLooping() {
		return prv(this).playlist.pllooping;
	}
	toggleLooping() {
		return prv(this).handler.toggleLooping(prv(this).playlist.guild);
	}
	togglePlaylistLooping() {
		return prv(this).handler.togglePlaylistLooping(prv(this).playlist.guild);
	}
	get guild() {
		return prv(this).playlist.guild;
	}
	get connected() {
		return prv(this).handler.isConnected(prv(this).playlist.guild);
	}
	get playing() {
		return prv(this).handler.isPlaying(prv(this).playlist.guild);
	}
	get current() {
		return prv(this).handler.currentInfo(prv(this).playlist.guild);
	}
	get info() {
		return prv(this).handler.playlistInfo(prv(this).playlist.guild);
	}
	get joinedAt() {
		return new Date(prv(this).playlist.joinedTimestamp);
	}
	get JoinedTimestamp() {
		return prv(this).playlist.joinedTimestamp;
	}
}

class InternalPlaylist extends EventEmitter {
	constructor(guild, client, handler) {
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
		this.handler = handler;
		this.joinedTimestamp = Date.now();

	}
	get simplified() {
		return new Playlist(this.handler, this);
	}
	async addMusic(music) {
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
	constructor(link, member, passes, file, playlist) {
		this.link = link;
		if (file) {
			this.title = this.link.split("/").pop();
			this.length = 0;
		} else this.website = videoWebsite(this.link);
		this.member = member;
		this.passes = passes;
		this.file = file;
		prv(this).playlist = playlist;
	}
	play() {
		if (!this.file) {
			if (this.website == "Youtube")
				return playYoutube(this.member.guild.voiceConnection, this.link, this.passes);
			else if (this.website == "Soundcloud")
				return playSoundcloud(this.member.guild.voiceConnection, this.link, this.passes);
		}
		else
			return this.member.guild.voiceConnection.playFile(this.link, {passes: this.passes, bitrate:"auto"});
	}
	get playlist() {
		return prv(this).playlist.simplified;
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
					props: Object.freeze(this.props)
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
				props: this.props
			});
		}
	}
}

// MODULES
MusicHandler.videoWebsite = videoWebsite;
MusicHandler.playYoutube = playYoutube;
MusicHandler.youtubeInfo = youtubeInfo;
MusicHandler.queryYoutube = queryYoutube;

module.exports = MusicHandler;
