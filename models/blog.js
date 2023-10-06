const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
    name: {
        type: String
    },
    By: {
        type: String
    },
    image: {
        type: String
    },
    images: [{
        type: String
    }],
    pdfs: [{
        type: String
    }],
    content: {
        type: String
    },
    links: [{
        type: String
    }],
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Assuming you have a User model
        required: true,
    },
    
});

const Blog = mongoose.model('Blog', blogSchema);

module.exports = Blog;


