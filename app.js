
const express = require('express')
const session = require('express-session')
const MongoStore = require('connect-mongo')(session)
const flash = require('connect-flash')
const markdown = require('marked')
const csrf = require('csurf')
const app = express()
const sanitizeHTML = require('sanitize-html')

// ROOT ENCODER // JSON ENCODER //
app.use(express.urlencoded({extended: false}))
app.use(express.json())

// CREATING API FOR USAGE FROM OTHER ENVIORMENTS
app.use('/api', require('./router-api'))

// SESSION COOKIE FOR REMEMBERING LOGIN //
let sessionOptions = session({
	secret: "Javascript is soooo cool",
	// IMPORTING MONGODB FOR SAVEING THE COOKIE TO DATABASE //
	store: new MongoStore({client: require('./db')}),
	resave: false,
	saveUninitialized: false,
	cookie: {maxAge: 1000 * 60 * 60 * 24, httpOnly: true}
})
app.use(sessionOptions)
app.use(flash())

app.use((req, res, next)=>{
	// make our markdown function available from within ejs templates
	res.locals.filterUserHTML = (content)=>{
		return sanitizeHTML(markdown(content), {allowedTags: ['p', 'br', 'ul', 'ol', 'li', 'strong', 'bold', 'i', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'], allowedAtributes: {}})
	}

	// make all error and success flash messages available from all templates
	res.locals.errors = req.flash("errors")
	res.locals.success = req.flash("success")

	// make current user id available on the req object
	if (req.session.user) {
		req.visitorId = req.session.user._id
	} else {
		req.visitorId = 0
	}

	// make usersession data available from within templates
	res.locals.user = req.session.user
	next()
})


// IMPORTING ALL THE ROOTS //
const router = require('./router')


// MAKE PUBLIC FOLDER // SET MAIN VIEWS FOLDER // AND DECODING .EJS FILES //
app.use(express.static('public'))
app.set('views', 'views')
app.set('view engine', 'ejs')

app.use(csrf())
app.use(function(req,res,next) {
	res.locals.csrfToken = req.csrfToken()
	next()
})

// START USING THE ROUTER FROM THE MAIN ROOT //
app.use('/', router)

app.use(function(err,req,res,next) {
	if (err) {
		if (err.code == "EBADCSRFTOKEN") {
			req.flash('errors', "Cross site request forgery detected.")
			req.session.save(() => res.redirect('/'))
		} else {
			res.render('404')
		}
	}
})

// CHANGING THE LISTENING APP REQUIERING HTTP BILT-IN MODULE
const server = require('http').createServer(app)
//  REQUIERING IO MODULE
const io = require('socket.io')(server)

io.use(function(socket,next) {
	sessionOptions(socket.request, socket.request.res, next)
})

// MAKEING A CONNECTION FOR IO
io.on('connection', function(socket) {
	if (socket.request.session.user) {
		let user = socket.request.session.user

		socket.emit('welcome', {username: user.username, avatar: user.avatar})

		socket.on('chatMessageFromBrowser', function(data) {
			socket.broadcast.emit('chatMessageFromServer', {message: sanitizeHTML(data.message, {allowedTags: [], allowedAtributes: {}}), username: user.username, avatar: user.avatar})
		})
	}
})

// EXPORTING THE EXPRESS() FOR FURTHER USE OUTSIDE OFF APP.JS //
// BUT NOW LATER ON WE ARE CHANGEING THE APP WITH SERVER
module.exports = server




