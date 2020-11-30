const dotenv = require('dotenv');
// CONFIGURING THE .ENV FOR SECURE VARIABLES  //
dotenv.config();
const mongodb = require('mongodb');

const PORT = process.env.PORT || 3000;

// MAIN DATABASE CONNECTION //
mongodb.connect(
    process.env.CONNECTIONSTRING,
    { useUnifiedTopology: true },
    (err, client) => {
        if (err) {
            throw err;
        }
        // EXPORTING THE CLIENT AS DB.JS MAKEING AVAILABLE THROU THE WHOLE APP  //
        module.exports = client;
        // REQUIREING EXPRESS() FOR LISTENING ON PORT AFTER CONNECTED TO THE DATABASE //
        const app = require('./app');
        app.listen(PORT, () =>
            console.log(
                `Server started on port ${PORT} and Connected to database.`
            )
        );
    }
);
