const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const passportLocalMongoose = require('passport-local-mongoose');

var User = new Schema({
    username: {
        type: String
    },
    password: {
        type: String
    },
    college: {
        type: String 
    },
    musicGenre: {
        type: String
    },
    selectedArtists: {
        type: Array,
        default: []
    },
    friends: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }]
});

User.plugin(passportLocalMongoose);

module.exports = mongoose.model('User', User);
