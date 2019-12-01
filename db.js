
const dotenv = require('dotenv')
// CONFIGURING THE .ENV FOR SECURE VARIABLES //
dotenv.config()
const mongodb = require('mongodb')


// MAIN DATABASE CONNECTION //
mongodb.connect(process.env.CONNECTIONSTRING, {useUnifiedTopology: true}, (err,client)=>{
	if (err) {throw err}
	// EXPORTING THE CLIENT AS DB.JS MAKEING AVAILABLE THROU THE WHOLE APP  //
	module.exports = client
	// REQUIREING EXPRESS() FOR LISTENING ON PORT AFTER CONNECTED TO THE DATABASE //
	const app = require('./app')
	app.listen(process.env.PORT, console.log(`Connected to Database and now Listening on Port: ${process.env.PORT}...`))
})