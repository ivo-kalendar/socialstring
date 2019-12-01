
const bcrypt = require('bcryptjs')
const usersCollection = require('../db').db().collection('users')
const validator = require('validator')
const md5 = require('md5')


//  CREATING THE MAIN CONSTRUCTOR USER FUNCTION //
let User = function(data, getAvatar) {
	this.data = data
	this.errors = []
	if (getAvatar == undefined) {getAvatar = false}
	if (getAvatar) {this.getAvatar()}
}

// CREATING USERS CONSTRUCTOR PROTOTYPE FUNCTION FOR CLEANUPS BEFORE REGISTER OR LOGIN //
User.prototype.cleanUp = function() {
	if (typeof(this.data.username) != 'string') {this.data.username = ''}
	if (typeof(this.data.email) != 'string') {this.data.email = ''}
	if (typeof(this.data.password) != 'string') {this.data.password = ''}

	// THE ONLEY PROPERTIES THAT WE ARE INTERASTED IN, OVERRITEING ANYTHING ELSE //
	// get rid of any bogus properties
	this.data = {
		username: this.data.username.trim().toLowerCase(),
		email: this.data.email.trim().toLowerCase(),
		password: this.data.password
	}
}

// CREATING USERS CONSTRUCTOR PROTOTYPE FUNCTION FOR VALIDATIONS BEFORE REGISTER //
User.prototype.validate = function() {
	return new Promise(async (resolve, reject)=>{
		if (this.data.username == '') {this.errors.push('You must provide a username.')}
		if (this.data.username.length > 0 && this.data.username.length < 3) {this.errors.push('Username must be at least 3 characters.')}
		if (this.data.username.length > 20) {this.errors.push('Username cannot exceed 20 characters.')}	
		if (this.data.username != ''  && !validator.isAlphanumeric(this.data.username)) {this.errors.push('Username can only contain letters and numbers.')}
		if (!validator.isEmail(this.data.email)) {this.errors.push('You must provide a valide email address.')}
		if (this.data.password == '') {this.errors.push('You must provide a password.')}
		if (this.data.password.length > 0 && this.data.password.length < 8) {this.errors.push('Password must be at least 8 characters.')}
		if (this.data.password.length > 50) {this.errors.push('Password cannot exceed 50 characters.')}

		//	Only if username is valid then check to see if it's already taken
		if (this.data.username.length > 2 && this.data.username.length < 31 && validator.isAlphanumeric(this.data.username)) {
			let usernameExists = await usersCollection.findOne({username: this.data.username})
			if (usernameExists) {this.errors.push('That username is already taken')}
		}

		//	Only if email is valid then check to see if it's already taken
		if (validator.isEmail(this.data.email)) {
			let emailExists = await usersCollection.findOne({email: this.data.email})
			if (emailExists) {this.errors.push('That email is already being used')}
		}
		resolve()
	})
}

// CREATING USERS CONSTRUCTOR PROTOTYPE FUNCTION FOR LOGIN AND EXECUTING THE CLEANUP FUNCTION //
User.prototype.login = function() {
	return new Promise((resolve, reject)=>{
		this.cleanUp()
		// IF USERNAME IS THE SAME THEN COMPARE HASHED PASSWORD WITH BCRYPT //
		usersCollection.findOne({username: this.data.username}).then((attemptedUser)=>{
			if (attemptedUser && bcrypt.compareSync(this.data.password, attemptedUser.password)) {
				this.data = attemptedUser
				this.getAvatar()
				resolve("Congrats!!")
			} else {
				reject("invalid user or password")
			}
		}).catch((err)=>{
			reject("Please try again later.")
		})
	})
}

// CREATING USERS CONSTRUCTOR PROTOTYPE FUNCTION FOR REGISTER AND EXECUTING TEH CLEANUP AND VALIDATE FUNCTIONS //
User.prototype.register = function(){
	return new Promise(async (resolve, reject)=>{
		// Step #1: Validate user Data
		this.cleanUp()
		await this.validate()
		// Step #2: Only if there are no validation errors then save the user data into database
		if (!this.errors.length) {

			// GENERATING ANOTHER HASHED PASSWORD FROM USERS INPUT AND SAVEING IN THE SALT VARIABLE STOREING IN THE DATABASE //
			// hash user password
			let salt = bcrypt.genSaltSync(10)
			this.data.password = bcrypt.hashSync(this.data.password, salt)
			await usersCollection.insertOne(this.data)
			this.getAvatar()
			resolve()
		} else {
			reject(this.errors)
		}
	})
}

User.prototype.getAvatar = function() {
	this.avatar = `https://gravatar.com/avatar/${md5(this.data.email)}?s=128`
}

User.findByUsername = (username)=>{
	return new Promise((resolve, reject)=>{
		if (typeof(username) != "string") {
			reject()
			return
		}
		usersCollection.findOne({username: username}).then((userDoc)=>{
			if (userDoc) {
				userDoc = new User(userDoc, true)
				userDoc = {
					_id: userDoc.data._id,
					username: userDoc.data.username,
					avatar: userDoc.avatar
				}
				resolve(userDoc)
			} else {
				reject()
			}
		}).catch(()=>{
			reject()
		})
	})
}

User.doesEmailExist = function(email) {
	return new Promise(async function(resolve, reject) {
		if(typeof(email) != "string") {
			resolve(false)
			return
		}
		let user = await usersCollection.findOne({email: email})
		if (user) {
			resolve(true)
		} else {
			resolve(false)
		}
	})
}

// EXPORTING THE MAIN USER CONSTRUCTOR FUNCTION MAKEING AVAILABLE THROUT THE APP //
module.exports = User