const express = require("express");
const app = express();
const cors = require("cors");
const cookieparser = require("cookie-parser")
const session = require('express-session')
const mysql = require("mysql2");
const bodyParser = require("body-parser")

app.use(cors({
    origin:['http://localhost:3000'],
    methods:["POST", "GET"],
    credentials: true
    }
));
app.use(express.json());
app.use(cookieparser());
app.use(session({
    secret:'secret',
    resave:false,
    saveUninitialized:false,
    cookie:{
        secure:false,
        maxAge: 3600000
    }

}))

const port = 8080;
const bcrypt = require("bcrypt")
app.use(bodyParser.json())

const multer = require("multer")
const upload = multer({dest:'uploads/'})
app.use('/uploads', express.static('uploads'));

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: "2004enioluwa",

});

db.connect((err) => {
    if (err) {
        console.log(err);
    } else {
        console.log("connected to database");
    }
});

db.query('CREATE DATABASE IF NOT EXISTS WEBPROJECTDB');
db.query('USE WEBPROJECTDB');



db.query('CREATE TABLE IF NOT EXISTS users (user_id INT PRIMARY KEY AUTO_INCREMENT, username VARCHAR(255) NOT NULL, password VARCHAR(255) NOT NULL, email VARCHAR(255), profile_pic_url VARCHAR(255), user_rank VARCHAR(255))');
db.query('CREATE TABLE IF NOT EXISTS channels (channel_id INT PRIMARY KEY AUTO_INCREMENT, channel_name VARCHAR(255) NOT NULL, creator_name VARCHAR(255),creator_id INT)');
db.query('CREATE TABLE IF NOT EXISTS messages (message_id INT PRIMARY KEY AUTO_INCREMENT, channel_id INT, parent_id INT, user_id INT,content TEXT,creator_name VARCHAR(255),creator_rank VARCHAR(255),upvote_count INT DEFAULT 0,downvote_count INT DEFAULT 0,image_path VARCHAR(255) ,timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
db.query('CREATE TABLE IF NOT EXISTS upvotes (upvote_id INT PRIMARY KEY AUTO_INCREMENT,user_id INT,message_id INT,timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
db.query('CREATE TABLE IF NOT EXISTS downvotes(downvote_id INT PRIMARY KEY AUTO_INCREMENT,user_id INT,message_id INT,timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');



app.post("/register", upload.single("image"), async (req, res) => {
    const { username, password, email, rank } = req.body;
    const image = req.file ? req.file.path : null;

    if (!username || !email || !password || !rank ) {
        return res.status(400).json({ error: "Username, email, password, and rank are required" });
    }

    // Check if the username or email already exists
    db.query('SELECT * FROM users WHERE  email = ?', [ email], (err, existingUsers) => {
        if (err) {
            console.log("user", err);
            return res.status(500).json({ error: "Internal server error" });
        }

        if (existingUsers.length > 0) {
            // A user with the same username or email already exists
            return res.status(409).json({ error: " a user with email already exist (login / choose a different one " });
        }

        // Hash the password before storing it in the database
        bcrypt.hash(password, 10, (hashErr, hashedPassword) => {
            if (hashErr) {
                console.log("bcrypt error", hashErr);
                return res.status(500).json({ error: "Internal server error" });
            }

            // Insert user into the 'users' table
            db.query(
                "INSERT INTO users (username, password, email, user_rank, profile_pic_url) VALUES (?, ?, ?, ?, ?)",
                [username, hashedPassword, email, rank, image],
                (insertErr, result) => {
                    if (insertErr) {
                        console.log("user insert", insertErr);
                        return res.status(500).json({ error: "Internal server error" });
                    }

                    res.status(201).json({ message: "User registered successfully" });
                }
            );
        });
    });
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Username and password are required" });
    }

    db.query(
        "SELECT * FROM users WHERE email = ?",
        [email],
        async (err, result) => {
            if (err) {
                console.error(err);
                req.session.name = result[0].username
                return res.status(500).json({ error: "Internal Server Error" });
            }

            if (result.length > 0) {
                const isPasswordValid = await bcrypt.compare(password, result[0].password);
                if (isPasswordValid) {
                    // return res.status(200).json({ message: "Login successful" });
                    req.session.name = result[0].username
                    return res.json(result)

                } else {
                    req.session.name = result[0].username
                    return res.status(401).json({ error: "Invalid username or password" });
                }
            } else {
                return res.status(401).json({ error: "Invalid username or password" });

            }
        }
    );
});

app.get('/authUser', (req, res) => {

    if (req.session.name) {
        console.log(req.session.name);
        res.status(200).json({ signedIn: true, UserName: req.session.name });
    }
    else {
        console.log('false');
        res.status(200).json({ signedIn: false });
    }
})

app.get('/logout', (req,res) => {
    req.session.name = null;
    return res.json({signedIn: false})
})



app.post("/create", async (req,res) =>{

    const {channelName, userId,username} = req.body
    if (!channelName) {
        return res.status(400).json({ error: "channel name is required" });
    }
    db.query(
        "INSERT INTO channels (channel_name,creator_id,creator_name) VALUES (?,?,?)",
        [channelName,userId,username],
        (err, result) => {
            if (err) {
                console.log("error creating channel:",err);
                res.status(500).json({ error: "Internal server error" });
            } else {
                res.status(201).json({ message: "channels created" });
            }
        }
    );

})


app.get("/channels", (req, res) => {
    const channel_id = req.query.channel_id;
    const searchTerm = req.query.searchTerm;

    // Check if channel_id is provided
    if (channel_id) {
        db.query('SELECT * FROM channels WHERE channel_id = ?', [channel_id], (err, results) => {
            if (err) {
                console.log("error getting channel:", err);
                res.status(500).json({ error: "Internal server error" });
            } else {
                res.json(results);
            }
        });
    } else if (searchTerm) {
        // If searchTerm is provided, search for channels that match the searchTerm
        const sql = 'SELECT * FROM channels WHERE channel_name LIKE ?';
        const searchTermWithWildcards = `%${searchTerm}%`;

        db.query(sql, [searchTermWithWildcards], (err, results) => {
            if (err) {
                console.log("error searching channels:", err);
                res.status(500).json({ error: "Internal server error" });
            } else {
                res.json(results);
            }
        });
    } else {
        // If neither channel_id nor searchTerm is provided, fetch all channels
        db.query('SELECT * FROM channels', (err, results) => {
            if (err) {
                console.log("error getting channels:", err);
                res.status(500).json({ error: "Internal server error" });
            } else {
                res.json(results);
            }
        });
    }
});

app.post("/create_message", upload.single("image"), async (req, res) => {
    try {
        const { channel_id, content, userid, username, creator_rank } = req.body;
        const image = req.file ? req.file.path : null;

        // Validation
        if (!content || !channel_id || !userid || !username) {
            return res.status(400).json({ error: "Invalid request parameters" });
        }

        // Use promise wrapper for database query
        const [result] = await db.promise().query(
            "INSERT INTO messages (channel_id, content, image_path, user_id, creator_name,creator_rank) VALUES (?, ?, ?, ?, ?,?)",
            [channel_id, content, image, userid, username,creator_rank]
        );

        // Handle successful query
        res.status(201).json({ message: "Message posted", messageId: result.insertId });
    } catch (error) {
        // Handle errors
        console.error("Error:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: "Duplicate entry detected" });
        } else {
            res.status(500).json({ error: "Internal server error" });
        }
    }
});




app.post("/create_replies", upload.single("image"), async (req, res) => {
    try {
        const { reply, message_id, userid, username,creator_rank } = req.body;
        const image = req.file ? req.file.path : null;

        // Validation
        if (!reply || !message_id || !userid || !username) {
            return res.status(400).json({ error: "Invalid request parameters" });
        }

        // Database query using promise wrapper
        const [result] = await db.promise().query(
            "INSERT INTO messages (parent_id, content, user_id, creator_name, image_path, creator_rank) VALUES (?, ?, ?, ?, ?, ?)",
            [message_id, reply, userid, username, image, creator_rank]
        );

        // Handle successful query
        res.status(201).json({ message: "Reply posted", replyId: result.insertId });
    } catch (error) {
        // Handle errors
        console.error("Error:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: "Duplicate entry detected" });
        } else {
            res.status(500).json({ error: "Internal server error" });
        }
    }
});










app.get("/messages", (req, res) => {
    const channel_id = req.query.channel_id;
    const searchTerm = req.query.searchTerm;

    // Check if channel_id is provided
    if (channel_id) {
        let sql = 'SELECT * FROM messages WHERE channel_id = ?';
        const params = [channel_id];

        // If searchTerm is provided, add a condition to the WHERE clause
        if (searchTerm) {
            sql += ' AND (content LIKE ? OR creator_name LIKE ?)';
            const searchTermWithWildcards = `%${searchTerm}%`;
            params.push(searchTermWithWildcards, searchTermWithWildcards);
        }

        db.query(sql, params, (err, results) => {
            if (err) {
                console.log("error getting messages:", err);
                res.status(500).json({ error: "Internal server error" });
            } else {
                res.json(results);
            }
        });
    } else {
        // If channel_id is not provided, fetch all messages that match the searchTerm
        let sql = 'SELECT * FROM messages WHERE content LIKE ? OR creator_name LIKE ?';
        const searchTermWithWildcards = `%${searchTerm}%`;
        const params = [searchTermWithWildcards, searchTermWithWildcards];

        db.query(sql, params, (err, results) => {
            if (err) {
                console.log("error getting messages:", err);
                res.status(500).json({ error: "Internal server error" });
            } else {
                res.json(results);
            }
        });
    }
});



app.get("/getuser", (req, res) => {
    const user_id = req.query.user_id;

    // Check if message_id is provided
    if (user_id) {
        const sql = 'SELECT * FROM users WHERE user_id = ?';
        db.query(sql, [user_id], (err, results) => {
            if (err) {
                console.log("Error getting replies", err);
                res.status(500).json({ error: "Internal server error" });
            } else {
                res.json(results);
            }
        });
    } else {
        // If message_id is not provided, send a response indicating it's required
        res.status(400).json({ error: "user_id is required in the query parameters" });
    }
});



app.get("/adminusers", (req, res) => {


        const sql = 'SELECT * FROM users';
        db.query(sql,  (err, results) => {
            if (err) {
                console.log("Error getting all users", err);
                res.status(500).json({ error: "Internal server error" });
            } else {
                res.json(results);
            }
        });

});

app.get("/adminmessages", (req, res) => {


    const sql = 'SELECT * FROM messages';
    db.query(sql,  (err, results) => {
        if (err) {
            console.log("Error getting all users", err);
            res.status(500).json({ error: "Internal server error" });
        } else {
            res.json(results);
        }
    });

});
app.get("/adminchannels", (req, res) => {


    const sql = 'SELECT * FROM channels';
    db.query(sql,  (err, results) => {
        if (err) {
            console.log("Error getting all channels", err);
            res.status(500).json({ error: "Internal server error" });
        } else {
            res.json(results);
        }
    });

});


app.get("/replies", (req, res) => {
    const message_id = req.query.message_id;

    // Check if message_id is provided
    if (message_id) {
        const sql = 'SELECT * FROM messages WHERE parent_id = ?';
        db.query(sql, [message_id], (err, results) => {
            if (err) {
                console.log("Error getting replies", err);
                res.status(500).json({ error: "Internal server error" });
            } else {
                res.json(results);
            }
        });
    } else {
        // If message_id is not provided, send a response indicating it's required
        res.status(400).json({ error: "message_id is required in the query parameters" });
    }
});

app.post('/updateuser',  upload.single("image"),async (req, res) => {
    const {  editusername, editedUserRank} = req.body;
    const user_id = req.query.user_id
    const image = req.file ? req.file.path : null;

    // Check if the user exists
    db.query('SELECT * FROM users WHERE user_id = ?', [user_id], (error, userResults) => {
        if (error) {
            console.error('Error checking user:', error);
            res.status(500).json({ error: 'Internal server error' });
        } else {
            if (userResults.length === 0) {
                res.status(404).json({ message: 'User not found' });
            } else {
                // Update user information
                db.query('UPDATE users SET username = ?, user_rank = ?, profile_pic_url = ? WHERE user_id = ?',
                    [editusername, editedUserRank, image, user_id],
                    (updateError) => {
                        if (updateError) {
                            console.error('Error updating user information:', updateError);
                            res.status(500).json({ error: 'Internal server error' });
                        } else {
                            console.log('User information updated successfully.');
                            console.log("",image)
                            res.status(200).json({ message: 'User information updated successfully' });
                        }
                    });
            }
        }
    });
});


app.post("/deletemessage", (req, res) => {
    const message_id = req.query.message_id;

    // Check if the user exists
    db.query('SELECT * FROM messages WHERE message_id = ?', [message_id], (error, userResults) => {
        if (error) {
            console.error('Error checking user:', error);
            res.status(500).json({ error: 'Internal server error' });
        } else {
            if (userResults.length === 0) {
                res.status(404).json({ message: 'User not found' });
            } else {
                // Delete the user
                db.query('DELETE FROM messages WHERE message_id = ?', [message_id], (deleteError) => {
                    if (deleteError) {
                        console.error('Error deleting message:', deleteError);
                        res.status(500).json({ error: 'Internal server error' });
                    } else {
                        console.log('message deleted successfully.');
                        res.status(200).json({ message: 'message deleted successfully' });
                    }
                });
            }
        }
    });
});

app.post("/deletechannels", (req, res) => {
    const channel_id = req.query.channel_id;

    // Check if the user exists
    db.query('SELECT * FROM channels WHERE channel_id = ?', [channel_id], (error, userResults) => {
        if (error) {
            console.error('Error checking channel:', error);
            res.status(500).json({ error: 'Internal server error' });
        } else {
            if (userResults.length === 0) {
                res.status(404).json({ message: 'User not found' });
            } else {
                // Delete the user
                db.query('DELETE FROM channels WHERE channel_id = ?', [channel_id], (deleteError) => {
                    if (deleteError) {
                        console.error('Error deleting channel', deleteError);
                        res.status(500).json({ error: 'Internal server error' });
                    } else {
                        console.log('channel deleted successfully.');
                        res.status(200).json({ message: 'channel deleted successfully' });
                    }
                });
            }
        }
    });
});

app.post("/deleteuser", (req, res) => {
    const user_id = req.query.user_id;

    // Check if the user exists
    db.query('SELECT * FROM users WHERE user_id = ?', [user_id], (error, userResults) => {
        if (error) {
            console.error('Error checking user:', error);
            res.status(500).json({ error: 'Internal server error' });
        } else {
            if (userResults.length === 0) {
                res.status(404).json({ message: 'User not found' });
            } else {
                // Delete the user
                db.query('DELETE FROM users WHERE user_id = ?', [user_id], (deleteError) => {
                    if (deleteError) {
                        console.error('Error deleting user:', deleteError);
                        res.status(500).json({ error: 'Internal server error' });
                    } else {
                        console.log('user deleted successfully.');
                        res.status(200).json({ message: 'User deleted successfully' });
                    }
                });
            }
        }
    });
});


app.post('/upvote', (req, res) => {
    const { messageid, userid } = req.body;

    // Check if the user has already voted (either upvote or downvote) for this message
    db.query('SELECT * FROM upvotes WHERE user_id = ? AND message_id = ?', [userid, messageid], (error, upvoteResults) => {
        if (error) {
            console.error('Error checking upvote:', error);
            res.status(500).json({ error: 'Internal server error' });
        } else {
            // If the user has already upvoted, remove the upvote
            if (upvoteResults.length > 0) {
                db.query('DELETE FROM upvotes WHERE user_id = ? AND message_id = ?', [userid, messageid], (deleteError) => {
                    if (deleteError) {
                        console.error('Error deleting upvote:', deleteError);
                        res.status(500).json({ error: 'Internal server error' });
                    }
                });
            }

            else {
                // If the user has not upvoted, add the upvote
                db.query('INSERT INTO upvotes (user_id, message_id) VALUES (?, ?)', [userid, messageid], (insertError) => {
                    if (insertError) {
                        console.error('Error inserting upvote:', insertError);
                        res.status(500).json({ error: 'Internal server error' });
                    }
                });
            }

            // Increment the upvote_count in the messages table
            db.query('UPDATE messages SET upvote_count = (SELECT COUNT(*) FROM upvotes WHERE message_id = ?) WHERE message_id = ?', [messageid, messageid], (updateError) => {
                if (updateError) {
                    console.error('Error updating upvote count:', updateError);
                    res.status(500).json({ error: 'Internal server error' });
                } else {
                    console.log('Upvote processed successfully.');
                    res.status(200).json({ message: 'Upvote processed successfully' });
                }
            });
        }
    });
});




app.post('/downvote', (req, res) => {
    const { messageid, userid } = req.body;

    // Check if the user has already voted (either upvote or downvote) for this message
    db.query('SELECT * FROM downvotes WHERE user_id = ? AND message_id = ?', [userid, messageid], (error, downvoteResults) => {
        if (error) {
            console.error('Error checking downvote:', error);
            res.status(500).json({ error: 'Internal server error' });
        } else {
            // If the user has already downvoted, remove the downvote
            if (downvoteResults.length > 0) {
                db.query('DELETE FROM downvotes WHERE user_id = ? AND message_id = ?', [userid, messageid], (deleteError) => {
                    if (deleteError) {
                        console.error('Error deleting downvote:', deleteError);
                        res.status(500).json({ error: 'Internal server error' });
                    }
                });
            } else {
                // If the user has not downvoted, add the downvote
                db.query('INSERT INTO downvotes (user_id, message_id) VALUES (?, ?)', [userid, messageid], (insertError) => {
                    if (insertError) {
                        console.error('Error inserting downvote:', insertError);
                        res.status(500).json({ error: 'Internal server error' });
                    }
                });
            }

            // Increment the downvote_count in the messages table
            db.query('UPDATE messages SET downvote_count = (SELECT COUNT(*) FROM downvotes WHERE message_id = ?) WHERE message_id = ?', [messageid, messageid], (updateError) => {
                if (updateError) {
                    console.error('Error updating downvote count:', updateError);
                    res.status(500).json({ error: 'Internal server error' });
                } else {
                    console.log('Downvote processed successfully.');
                    res.status(200).json({ message: 'Downvote processed successfully' });
                }
            });
        }
    });
});







app.listen(port, () => {
    console.log(`running on port ${port}`);
});