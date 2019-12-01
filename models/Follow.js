
const usersCollection = require('../db').db().collection("users")
const followsCollection = require('../db').db().collection("follows")
const ObjectID = require('mongodb').ObjectID
const User = require('./User')


let Follow = function(followedUsername, autorId) {
	this.followedUsername = followedUsername
	this.autorId = autorId
	this.errors = []
}

Follow.prototype.cleanUp = function() {
	if (typeof(this.followedUsername) != "string") {this.followedUsername = ""}
}

Follow.prototype.validate = async function(action) {
	// followed username must exists in database
	let followedAccount = await usersCollection.findOne({username: this.followedUsername})
	if (followedAccount) {
		this.followedId = followedAccount._id
	} else {
		this.errors.push("You cannot follow a user that does not exists.")
	}

	let doesFollowAlreadyExists = await followsCollection.findOne({followedId: this.followedId, autorId: new ObjectID(this.autorId)})
	if (action == "create") {
		if (doesFollowAlreadyExists) {this.errors.push("You already following this user.")}
	}
	if (action == "delete") {
		if (!doesFollowAlreadyExists) {this.errors.push("You cannot stop following someone you do not already fallow.")}
	}

	// should not be able to follow yourself
	if (this.followedId.equals(this.autorId)) {this.errors.push("You cannot follow yourself.")}
}

Follow.prototype.create = function() {
	return new Promise(async (resolve, reject) => {
		this.cleanUp()
		await this.validate("create")
		if (!this.errors.length) {
			await followsCollection.insertOne({followedId: this.followedId, autorId: new ObjectID(this.autorId)})
			resolve()
		} else {
			reject(this.errors)
		}
	})
}

Follow.prototype.delete = function() {
	return new Promise(async (resolve, reject) => {
		this.cleanUp()
		await this.validate("delete")
		if (!this.errors.length) {
			await followsCollection.deleteOne({followedId: this.followedId, autorId: new ObjectID(this.autorId)})
			resolve()
		} else {
			reject(this.errors)
		}
	})
}

Follow.isVisitorFollowing = async function(followedId, visitorId) {
	let followDoc = await followsCollection.findOne({followedId: followedId, autorId: new ObjectID(visitorId)})	
	if (followDoc) {
		return true
	} else {
		return false
	}
}

Follow.getFollowersById = function(id) {
	return new Promise(async (resolve, reject) => {
		try {
			let followers = await followsCollection.aggregate([
					{$match: {followedId: id}},
					{$lookup: {from: "users", localField: "autorId", foreignField: "_id", as: "userDoc"}},
					{$project: {
						username: {$arrayElemAt: ["$userDoc.username", 0]},
						email: {$arrayElemAt: ["$userDoc.email", 0]}
					}}
				]).toArray()
			followers = followers.map(function(follower) {
				let user = new User(follower, true)
				return {username: follower.username, avatar: user.avatar}
			})
			resolve(followers)
		} catch {
			reject()
		}
	})
}

Follow.getFollowingById = function(id) {
	return new Promise(async (resolve, reject) => {
		try {
			let followers = await followsCollection.aggregate([
					{$match: {autorId: id}},
					{$lookup: {from: "users", localField: "followedId", foreignField: "_id", as: "userDoc"}},
					{$project: {
						username: {$arrayElemAt: ["$userDoc.username", 0]},
						email: {$arrayElemAt: ["$userDoc.email", 0]}
					}}
				]).toArray()
			followers = followers.map(function(follower) {
				let user = new User(follower, true)
				return {username: follower.username, avatar: user.avatar}
			})
			resolve(followers)
		} catch {
			reject()
		}
	})
}

Follow.countFollowersById = function(id) {
	return new Promise(async (resolve, reject) => {
		let followerCount = await followsCollection.countDocuments({followedId: id})
		resolve(followerCount)
	})
}

Follow.countFollowingById = function(id) {
	return new Promise(async (resolve, reject) => {
		let count = await followsCollection.countDocuments({autorId: id})
		resolve(count)
	})
}

module.exports = Follow