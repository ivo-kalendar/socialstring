
const postsCollection = require('../db').db().collection("posts")
const followsCollection = require('../db').db().collection("follows")
const ObjectID = require('mongodb').ObjectID
const User = require('./User')
const sanitizeHTML = require('sanitize-html')

let Post = function(data, userid, requestedPostId) {
	this.data = data
	this.errors = []
	this.userid = userid
	this.requestedPostId = requestedPostId
}

Post.prototype.cleanUp = function() {
	if (typeof(this.data.title) != "string") {this.data.title = ""}
	if (typeof(this.data.body) != "string") {this.data.body = ""}

	// get rid of any bogus properties
	this.data = {
		title: sanitizeHTML(this.data.title.trim(), {allowedTags: [], allowedAttributes: {}}),
		body: sanitizeHTML(this.data.body.trim(), {allowedTags: [], allowedAttributes: {}}),
		createdDate: new Date(),
		autor: ObjectID(this.userid)
	}
}

Post.prototype.validate = function() {
	if (this.data.title == "") {this.errors.push("You must provide Title.")}
	if (this.data.body == "") {this.errors.push("You must provide content.")}
};

Post.prototype.create = function() {
	return new Promise((resolve, reject)=>{
		this.cleanUp()
		this.validate()
		if (!this.errors.length) {
			// save post into database
			postsCollection.insertOne(this.data).then((info)=>{
				resolve(info.ops[0]._id)
			}).catch(()=>{
				this.errors.push("please try again later.")
				reject(this.errors)
			})
		} else {
			reject(this.errors)
		}
	})
}

Post.prototype.update = function() {
	return new Promise(async (resolve, reject)=>{
		try {
			let post = await Post.findSingleById(this.requestedPostId, this.userid)
			if (post.isVisitorOwner) {
				// actully update db
				let status = await this.actuallyUpdate()
				resolve(status)
			} else {
				reject()
			}
		} catch {
			reject()
		}
	})
}

Post.prototype.actuallyUpdate = function() {
	return new Promise(async (resolve, reject)=>{
		this.cleanUp()
		this.validate()
		if (!this.errors.length) {
			await postsCollection.findOneAndUpdate({_id: new ObjectID(this.requestedPostId)}, {$set: {title: this.data.title, body: this.data.body}})
			resolve("success")
		} else {
			resolve("failure")
		}
	})
}

Post.reusablePostQuery = (uniqueOperations, visitorId)=>{
	return new Promise(async (resolve, reject)=>{

		let aggOperations = uniqueOperations.concat([
			{$lookup: {from: "users", localField: "autor", foreignField: "_id", as: "authorDocument"}},
			{$project: {
				title: 1,
				body: 1,
				createdDate: 1,
				autorId: "$autor",
				autor: {$arrayElemAt: ["$authorDocument", 0]}
			}}
		])
		
		let posts = await postsCollection.aggregate(aggOperations).toArray()

		// clean up autor property in each post object
		posts = posts.map((post)=>{
			post.isVisitorOwner = post.autorId.equals(visitorId)
			post.autorId = undefined

			post.autor = {
				username: post.autor.username,
				avatar: new User(post.autor, true).avatar
			}
			return post
		})

		resolve(posts)
	})
}

Post.findSingleById = (id, visitorId)=>{
	return new Promise(async (resolve, reject)=>{
		if (typeof(id) != "string" || !ObjectID.isValid(id)) {
			reject()
			return
		}
		
		let posts = await Post.reusablePostQuery([
			{$match: {_id: new ObjectID(id)}}
		], visitorId)

		if (posts.length) {
			resolve(posts[0])
		} else {
			reject()
		}
	})
}

Post.findByAuthorId = (authorId)=>{
	return Post.reusablePostQuery([
		{$match: {autor: authorId}},
		{$sort: {createdDate: -1}}
	])
}

Post.delete = function(postIdToDelete, currentUserId) {
	return new Promise(async (resolve, reject)=>{
		try {
			let post = await Post.findSingleById(postIdToDelete, currentUserId)
			if (post.isVisitorOwner) {
				await postsCollection.deleteOne({_id: new ObjectID(postIdToDelete)})
				resolve()
			} else {
				reject()
			}
		} catch {
			reject()
		}
	})
}

Post.search = (searchTerm)=>{
	return new Promise(async (resolve, reject)=>{
		if (typeof(searchTerm) == "string") {
			let posts = await Post.reusablePostQuery([
					{$match: {$text: {$search: searchTerm}}},
					{$sort: {score: {$meta: "textScore"}}}
				])
			resolve(posts)
		} else {
			reject()
		}
	})
}

Post.countPostsByAutor = function(id) {
	return new Promise(async (resolve, reject) => {
		let postCount = await postsCollection.countDocuments({autor: id})
		resolve(postCount)
	})
}

Post.getFeed = async function(id) {
	//  create an array of the user ids that the current user follows
	let followedUsers = await followsCollection.find({autorId: new ObjectID(id)}).toArray()
	followedUsers = followedUsers.map(function(followDoc) {
		return followDoc.followedId
	})

	// look for posts where the autor is the above array of followed users
	return Post.reusablePostQuery([
			{$match: {autor: {$in: followedUsers}}},
			{$sort: {createdDate: -1}}
		])
}

module.exports = Post
