const express = require("express");
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const bodyParser = require("body-parser");
const ejs = require("ejs");
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mongoose = require('mongoose');
const User = require('./models/User');
const Blog = require('./models/blog');
require('dotenv').config();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
const aboutstarttext = "This comprehensive outline covers a wide range of topics in full-stack web development, ensuring that you won't miss any critical aspect of the field. You can expand on each topic as needed in your book to provide readers with a thorough understanding of full-stack web development."
const contactstarttext = "By the end of this chapter, you'll have a strong grasp of HTML5 basics, including markup, document structure, common elements, and attributes. With this knowledge, you'll be well-prepared to start creating web content using HTML5."

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

// Define Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const user = await User.findOne({ googleId: profile.id }).exec();

        if (!user) {
            // Create a new user in your database
            const newUser = new User({
                googleId: profile.id,
                email: profile.emails[0].value,
                name: profile.displayName,
                profilePicture: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null,
                // Add other properties as needed
            });

            await newUser.save();
            return done(null, newUser);
        } else {
            // User already exists, log them in
            return done(null, user);
        }
    } catch (error) {
        return done(error);
    }
}));

// Serialize user into the session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id).exec();
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// Google Authentication Routes
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        // Successful authentication, redirect to home
        res.redirect('/');
    }
);

// Logout route
app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        res.redirect('/');
    });
});


// Middleware to check if the user is authenticated
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
};

// Homepage route
app.get("/", ensureAuthenticated, async (req, res) => {
    try {
        const userPosts = await Blog.find({ author: req.user._id }).exec();

        res.render("home", { user: req.user, userPosts: userPosts });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get("/read/:postId", ensureAuthenticated, async (req, res) => {
    try {
        const postId = req.params.postId;
        const userPost = await Blog.findById(postId).exec();

        res.render("read", { user: req.user, userPost: userPost });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route for handling the form submission
app.post("/submit/:postId", async (req, res) => {
    try {
        const postId = req.params.postId;
        // Process the form submission using the postId
        // ...
        res.redirect(`/read/${postId}`);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get("/login", function (req, res) {
    res.render("login");
});
// Compose route
app.get("/compose", ensureAuthenticated, (req, res) => {
    res.render("compose", { user: req.user });
});

// Handle post creation
app.post("/compose", ensureAuthenticated, upload.fields([
    { name: 'images', maxCount: 4 },
    { name: 'pdfs', maxCount: 2 }
]), async (req, res) => {
    const { title, content, links } = req.body;
    const images = req.files['images'] ? req.files['images'].map(file => file.buffer.toString("base64")) : [];
    const pdfs = req.files['pdfs'] ? req.files['pdfs'].map(file => file.buffer.toString("base64")) : [];
    const linksArray = links ? links.split(',').map(link => link.trim()) : [];

    try {
        const isDataStored = await Blog.create({
            name: title,
            By: req.user.name,
            image:req.user.profilePicture,
            images: images,
            pdfs: pdfs,
            content: content,
            links: linksArray,
            author: req.user._id
        });

        if (!isDataStored) {
            console.log('Error storing data');
        }

        console.log('Data stored successfully');
        res.redirect("/my-posts");
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});
// ... (Any other existing routes you may have)

app.get("/posts", ensureAuthenticated, async (req, res) => {
    try {
        // Fetch user-specific data
        const user = {
            name: req.user.name, // Adjust based on your user object
            profilePicture: req.user.profilePicture // Adjust based on your user object
        };

        // Fetch all blog posts
        const allBlogs = await Blog.find({});

        // Render the posts page with additional data
        res.render('post', { user, allBlogs });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});




app.get('/my-posts', ensureAuthenticated, async (req, res) => {
    try {
        // Fetch user-specific data
        const user = {
            name: req.user.name, // Adjust based on your user object
            profilePicture: req.user.profilePicture // Adjust based on your user object
        };

        // Fetch all blog posts created by the authenticated user
        const allBlogs = await Blog.find({ author: req.user._id });

        // Render the my-posts page with additional data
        res.render('my-posts', { user, allBlogs });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = app;


// Assume you have a route for deleting a blog post, e.g., /delete/:postId

app.get("/delete/:postId", ensureAuthenticated, async (req, res) => {
    const postId = req.params.postId;

    try {
        // Find the blog post by ID
        const blogPost = await Blog.findById(postId).exec();

        if (!blogPost) {
            // Blog post not found
            return res.status(404).send("Blog post not found");
        }

        // Check if the authenticated user is the creator of the blog post
        if (blogPost.author.toString() !== req.user._id.toString()) {
            // User is not the creator, don't allow deletion
            return res.status(403).send("Permission denied");
        }

        // User is the creator, proceed with deletion
        await Blog.findByIdAndDelete(postId).exec();

        console.log('Blog post deleted successfully');
        res.redirect("/"); // Redirect to the home page or another suitable location
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Assume you have a route for handling the deletion, e.g., /delete/:postId

app.post("/delete/:postId", ensureAuthenticated, async (req, res) => {
    const postId = req.params.postId;

    try {
        // Find the blog post by ID
        const blogPost = await Blog.findById(postId).exec();

        if (!blogPost) {
            // Blog post not found
            return res.status(404).send("Blog post not found");
        }

        // Check if the authenticated user is the creator of the blog post
        // Check if the authenticated user is the creator of the blog post
        if (!blogPost.author || blogPost.author.toString() !== req.user._id.toString()) {
            // User is not the creator, don't allow deletion
            return res.status(403).send("Permission denied");
        }



        // User is the creator, proceed with deletion
        await Blog.findByIdAndDelete(postId).exec();

        console.log('Blog post deleted successfully');
        res.redirect("/my-posts"); // Redirect to the home page or another suitable location
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send(`Internal Server Error: ${error.message}`);
    }

});



app.get("/about", ensureAuthenticated, async (req, res) => {
    try {
        // Fetch user-specific data
        const user = {
            name: req.user.name, // Adjust based on your user object
            profilePicture: req.user.profilePicture // Adjust based on your user object
        };

        res.render("about", { user, aboutstartpoint: aboutstarttext });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get("/contact", ensureAuthenticated, async (req, res) => {
    try {
        // Fetch user-specific data
        const user = {
            name: req.user.name, // Adjust based on your user object
            profilePicture: req.user.profilePicture // Adjust based on your user object
        };

        res.render("contact", { user, contactstartpoint: contactstarttext });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});




// ... (Previous code)

// Like, Share, and Download routes
// Assuming you have a route for handling the like action, e.g., /like/:postId


// ... (Other routes)

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
