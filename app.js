const express = require("express"),
    mongoose = require("mongoose"),
    passport = require("passport"),
    bodyParser = require("body-parser"),
    LocalStrategy = require("passport-local"),
    passportLocalMongoose = require("passport-local-mongoose"),
    axios = require('axios');
const User = require("./model/User");
require('dotenv').config();

let app = express();

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});
app.use(express.static('public'));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(require("express-session")({
    secret: "Rusty is a dog",
    resave: false,
    saveUninitialized: false
}));
app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    next();
});
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

async function getSpotifyAccessToken() {
    const authOptions = {
        method: 'post',
        url: 'https://accounts.spotify.com/api/token',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: 'grant_type=client_credentials'
    };

    try {
        const response = await axios(authOptions);
        return response.data.access_token;
    } catch (error) {
        console.error('Error getting Spotify access token:', error);
        throw error;
    }
}

//=====================
// ROUTES
//=====================

// Showing home page

app.get("/", async function (req, res) {
    try {
        // Check if the user is authenticated
        if (!req.isAuthenticated()) {
            return res.redirect("/home");
        }

        // Fetch the user's data from MongoDB
        const user = await User.findById(req.user._id);

        // Render the home page with user data
        res.render("homepage", { user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// Showing secret page
app.get("/secret", function (req, res) {
    res.render("secret");
});

app.get("/termsconditions", function (req, res) {
    res.render("termsconditions");
});

// Showing register form
app.get("/register", function (req, res) {
    res.render("register");
});

// Handling user signup
app.post("/register", async (req, res) => {
    try {
        const user = new User({
            username: req.body.username,
            college: req.body.college, 
            musicGenre: req.body.musicGenre,
        });
        const registeredUser = await User.register(user, req.body.password);
        res.redirect(`/ms?user=${registeredUser._id}`);
    } catch (err) {
        console.error(err);
        res.redirect("/register");
    }
});

// Showing ms (select artists) page
app.get("/ms", async (req, res) => {
    try {
        const userId = req.query.user;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).send('Invalid user ID');
        }

        // Get the search query from the request
        const searchQuery = req.query.search || '';

        // Check if the search query is empty
        if (!searchQuery.trim()) {
            // If the search query is empty, render the page without making a request to Spotify API
            return res.render('ms', { artists: [], userId, searchQuery });
        }

        // Fetch artists from Spotify API based on search query
        const accessToken = await getSpotifyAccessToken();
        const searchResponse = await axios.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=artist`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        // Extract artist information from the search response
        const artists = searchResponse.data.artists.items.map(artist => ({
            name: artist.name,
            imageUrl: artist.images.length > 0 ? artist.images[0].url : null
        }));

        res.render('ms', { artists, userId, searchQuery }); // Pass searchQuery to the template
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});



// Handling selected artists
app.post("/ms", async (req, res) => {
    try {
        const userId = req.body.userId;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).send('Invalid user ID');
        }

        const selectedArtists = Array.isArray(req.body.selectedArtists) ? req.body.selectedArtists.map(artist => JSON.parse(artist)) : [];
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).send('User not found');
        }

        user.selectedArtists = selectedArtists;
        await user.save();

        res.redirect("/homepage");
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});




// Showing login form
app.get("/login", function (req, res) {
    res.render("login");
});
app.get("/homepage", function (req, res) {
    if (req.isAuthenticated()) {
        res.render('homepage', { user: req.user });
    } else {
        res.redirect("/login");
    }
});
// Handling user login
app.post("/login", passport.authenticate("local", {
    successRedirect: "/homepage",
    failureRedirect: "/login"
}), function (req, res) {});

// Handling user logout
app.get("/logout", function (req, res) {
    req.logout(function (err) {
        if (err) {
            return next(err);
        }
        res.redirect('/');
    });
});

function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect("/home");
}
app.get('/home', function(req,res) {
    res.render('home');
})
let port = process.env.PORT || 3000;
app.listen(port, function () {
    console.log("Server Has Started!");
});
