const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const port = 5000;

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

const dbConfig = {
    host: '77.223.138.139',
    user: 'projech1_kullanici',
    password: 'L6P]hm6(3cSOd9',
    database: 'projech1_data'
};

const dbPool = mysql.createPool(dbConfig);

const getConnectionAndExecute = (req, res, callback) => {
    dbPool.getConnection((err, connection) => {
        if (err) {
            console.error('Veritabanı bağlantı hatası:', err);
            res.status(500).json({error: 'Veritabanı bağlantı hatası'});
            return;
        }

        callback(connection);
    });
};

//---------------------------------------------------------user---------------------------------------------------------
const storageUser = multer.diskStorage({
    destination: (req, file, cb) => {
        const targetDirectory = '/var/www/html/uploads/user/profile'; //uploads/user/profile
        fs.mkdirSync(targetDirectory, {recursive: true});
        cb(null, targetDirectory);
    },
    filename: (req, file, cb) => {
        const uniqueId = crypto.randomBytes(4).toString('hex');
        const modifiedFileName = `PCT_${uniqueId}_${file.originalname}`;
        cb(null, modifiedFileName);
    }
});
const uploadUser = multer({storage: storageUser}).single('photo'); // "photo" alan adını uygun şekilde değiştirin

app.post('/api/user/upload', (req, res) => {
    uploadUser(req, res, (err) => {
        if (err) {
            console.log('Error uploading profile photo:', err);
            res.status(400).json({success: false, message: 'Fotoğraf yüklenemedi.'});
        } else {
            const imageUrl = `http://23.26.248.43/uploads/user/profile/${req.file.filename}`;
            res.json({success: true, imageUrl: imageUrl});
        }
    });
});

app.post('/api/user/delete/profile', (req, res) => {
    const {fileUrl} = req.body;

    // Dosya adını ayıklayarak dosyanın adını elde edin
    const fileName = fileUrl.split('/').pop();

    // Dosyanın bulunduğu dizin
    const targetDirectory = '/var/www/html/uploads/user/profile';

    // Dosya yolunu oluşturun
    const filePathUser = `${targetDirectory}/${fileName}`;

    // Dosyayı sil
    fs.unlink(filePathUser, (err) => {
        if (err) {
            console.log('Dosya silinirken bir hata oluştu:', err);
            res.status(500).json({success: false, message: 'Dosya silinirken bir hata oluştu.'});
        } else {
            console.log('Dosya başarıyla silindi:', filePathUser);
            res.json({success: true, message: 'Dosya başarıyla silindi.'});
        }
    });
});

app.post('/api/user/update', (req, res) => {
    const {userid, username, userbio, profilephoto} = req.body;

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'SELECT * FROM users WHERE userid = ?', [userid],
            (err, results) => {
                if (err) {
                    console.log('Error querying MySQL:', err);
                    res.status(500).send('Error querying database.');
                } else if (results.length === 0) {
                    console.log('User with provided id not found.');
                    res.status(404).send(`User not found ${userid}.`);
                } else {
                    const user = results[0];

                    // username, userbio veya profilephoto varsa güncelle
                    if (username) user.username = username;
                    if (userbio) user.userbio = userbio;
                    if (profilephoto) user.profilephoto = profilephoto;

                    getConnectionAndExecute(req, res, (connection) => {
                        connection.query(
                            'UPDATE users SET username = ?, userbio = ?, profilephoto = ? WHERE userid = ?',// WHERE username
                            [user.username, user.userbio, user.profilephoto, userid],
                            (err, results) => {
                                if (err) {
                                    console.log('Error updating user in MySQL:', err);
                                    res.status(500).send('Error updating user in database.');
                                } else {
                                    console.log('User updated successfully.');
                                    res.status(200).send('User updated successfully.');
                                }
                            }
                        );
                    });
                }
            }
        );
    });
});

app.post('/api/user/signup', (req, res) => {
    const {name, lastname, email, username, userbio, password, profilephoto, twofactor, status} = req.body;

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'INSERT INTO users (name, lastname, email, username, userbio, password, profilephoto, twofactor, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [name, lastname, email, username, userbio, password, profilephoto, twofactor, status],
            (err, results) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        console.log(`User already exists with email ${email}.`);
                        res.status(409).send({error: 'Conflict: User already exists with this email.'});
                    } else if (err.code === 'ER_DUP_ENTRY' && err.sqlMessage.includes('username')) {
                        console.log(`User already exists with username ${username}.`);
                        res.status(409).send({error: 'Conflict: User already exists with this username.'});
                    } else {
                        console.log('Error inserting into MySQL:', err);
                        res.status(500).send({error: 'Internal Server Error: Please try again later.'});
                    }
                } else {
                    console.log('Inserted into MySQL:', results);
                    res.status(200).send({message: 'User successfully inserted into database.'});
                }
            }
        );
    });
});

app.post('/api/user/login', (req, res) => {
    const {email, password} = req.body;

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'SELECT * FROM users WHERE email = ? AND password = ?', [email, password],
            (err, results) => {
                if (err) {
                    console.log('Error querying MySQL:', err);
                    res.status(500).send({error: 'Internal Server Error: Please try again later.'});
                } else if (results.length === 0) {
                    console.log('No user found with provided credentials.');
                    res.status(401).send({error: 'Unauthorized: Invalid email or password.'});
                } else if (results[0].status === 0) {
                    console.log('User is either disabled or deleted.');
                    res.status(403).send({error: 'Unauthorized: This account is either disabled or deleted.'});
                } else if (results[0].twofactor === 1) {
                    console.log('İki faktörlü doğrulama gerekiyor.');
                    res.status(200).send({twofactor: 1});
                } else {
                    console.log('User found:', results[0]);
                    res.status(200).send(results);
                }
            }
        );
    });
});

app.post('/api/user/login/google', (req, res) => {
    const {email} = req.body;

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'SELECT * FROM users WHERE email = ?',
            [email],
            (err, results) => {
                if (err) {
                    console.log('MySQL sorgulama hatası:', err);
                    res.status(500).send({error: 'Internal Server Error: Please try again later.'});
                } else {
                    if (results.length === 0) {
                        console.log('Sağlanan kimlik bilgileriyle hiçbir kullanıcı bulunamadı.');
                        res.status(401).send({error: 'Unauthorized: Invalid email or password.'});
                    } else {
                        const user = results[0];
                        if (user.status === 0) {
                            console.log('Kullanıcı devre dışı veya silinmiş durumda.');
                            res.status(403).send({error: 'Unauthorized: This account is either disabled or deleted.'});
                        } else if (user.twofactor === 1) {
                            console.log('İki faktörlü doğrulama gerekiyor.');
                            res.status(200).send({twofactor: 1});
                        } else {
                            console.log('Kullanıcı bulundu:', user);
                            res.status(200).send(user);
                        }
                    }
                }
            }
        );
    });
});

app.post('/api/user/deleteuser', (req, res) => {
    const {username, password} = req.body;

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'UPDATE users SET status = 0 WHERE username = ? AND password = ?', [username, password],
            (err, results) => {
                if (err) {
                    console.log('Error querying MySQL:', err);
                    res.status(500).send('Error updating user status in database.');
                } else if (results.affectedRows === 0) {
                    console.log('No user found with provided credentials.');
                    res.status(401).send('Invalid username or password.');
                } else {
                    console.log('User status updated:', results.affectedRows);
                    res.status(200).send('User status set to 0.');
                }
            }
        );
    });
});

app.put('/api/user/changepassword', (req, res) => {
    const {username, password, newpassword} = req.body;

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'UPDATE users SET password = ? WHERE username = ? AND password = ?',
            [newpassword, username, password],
            (err, results) => {
                if (err) {
                    console.log('Error querying MySQL:', err);
                    res.status(500).send('Error updating user password in database.');
                } else if (results.affectedRows === 0) {
                    console.log('No user found with provided credentials.');
                    res.status(401).send('Invalid username or password.');
                } else {
                    console.log('User password updated:', results.affectedRows);
                    res.status(200).send('User password updated.');
                }
            }
        );
    });
});

app.post('/api/user/forgotpassword', (req, res) => {
    const {username, email} = req.body;

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'SELECT * FROM users WHERE username = ? AND email = ?',
            [username, email],
            (err, results) => {
                if (err) {
                    console.log('Error querying MySQL:', err);
                    res.status(500).send('Error retrieving user information from database.');
                } else if (results.length === 0) {
                    console.log('No user found with provided credentials.');
                    res.status(401).send('Invalid username or email.');
                } else if (results[0].twofactor === 1) {
                    console.log('İki faktörlü doğrulama gerekiyor.');
                    res.status(200).send({twofactor: 1});
                } else {
                    console.log('User found:', results[0]);
                    res.status(200).send('User information is correct.');
                }
            }
        );
    });
});

app.put('/api/user/createpassword', (req, res) => {
    const {username, newPassword} = req.body;

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'UPDATE users SET password = ? WHERE username = ?',
            [newPassword, username],
            (err, results) => {
                if (err) {
                    console.log('Error updating password in the database:', err);
                    res.status(500).send('Error updating password.');
                } else if (results.affectedRows === 0) {
                    console.log('No user found with provided username.');
                    res.status(401).send('Invalid username.');
                } else {
                    console.log('Password updated successfully for user:', username);
                    res.status(200).send('Password updated successfully.');
                }
            }
        );
    });
});

app.post('/api/user/twofactoractive', (req, res) => {
    const {username, password} = req.body;

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'UPDATE users SET twofactor = 1 WHERE username = ? AND password = ?', [username, password],
            (err, results) => {
                if (err) {
                    console.log('Error querying MySQL:', err);
                    res.status(500).send('Error updating user status in database.');
                } else if (results.affectedRows === 0) {
                    console.log('No user found with provided credentials.');
                    res.status(401).send('Invalid username or password.');
                } else if (results.changedRows === 0) {
                    console.log('User already has Two-Factor Authentication active.');
                    res.status(409).send('User already has Two-Factor Authentication active.');
                } else {
                    console.log('User twofactor updated:', results.affectedRows);
                    res.status(200).send('User twofactor set to 1.');
                }
            }
        );
    });
});

app.post('/api/user/twofactordeactive', (req, res) => {
    const {username, password} = req.body;

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'UPDATE users SET twofactor = 0 WHERE username = ? AND password = ?',
            [username, password],
            (err, results) => {
                if (err) {
                    console.log('Error querying MySQL:', err);
                    res.status(500).send('Error updating user status in database.');
                } else if (results.affectedRows === 0) {
                    console.log('No user found with provided credentials.');
                    res.status(401).send('Invalid username or password.');
                } else {
                    console.log('User twofactor updated:', results.affectedRows);
                    res.status(200).send('User twofactor set to 0.');
                }
            }
        );
    });
});

app.post('/api/user/finduserid', (req, res) => {
    const {email} = req.body;

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'SELECT userid FROM users WHERE email = ?', [email],
            (err, results) => {
                if (err) {
                    console.error(err);
                    res.status(500).json({error: 'Server error'});
                } else {
                    if (results.length > 0) {
                        const userid = results[0].userid;
                        res.status(200).json({userid: userid});
                    } else {
                        res.status(404).json({error: 'User not found'});
                    }
                }
            }
        );
    });
});

app.post('/api/user/usernametoemail', (req, res) => {
    const {username} = req.body;

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'SELECT email FROM users WHERE username = ?', [username],
            (err, results) => {
                if (err) {
                    // Hata durumunda uygun bir işlem yapılabilir
                    console.error(err);
                    res.status(500).json({error: 'Server error'});
                } else {
                    if (results.length > 0) {
                        const email = results[0].email;
                        res.status(200).json({email: email});
                    } else {
                        res.status(404).json({error: 'User not found'});
                    }
                }
            }
        );
    });
});

app.post('/api/user/emailtousername', (req, res) => {
    const {email} = req.body;

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'SELECT username FROM users WHERE email = ?', [email],
            (err, results) => {
                if (err) {
                    // Hata durumunda uygun bir işlem yapılabilir
                    console.error(err);
                    res.status(500).json({error: 'Server error'});
                } else {
                    if (results.length > 0) {
                        const username = results[0].username;
                        res.status(200).json({username: username});
                    } else {
                        res.status(404).json({error: 'User not found'});
                    }
                }
            }
        );
    });
});

app.get('/api/user/get', (req, res) => {
    const userId = req.query.userid; //çalışıyorsa dokunma

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'SELECT username, userbio, profilephoto, email FROM users WHERE userid = ?',
            [userId],
            (err, results) => {
                if (err) {
                    console.error('MySQL sorgu hatası:', err);
                    res.status(500).json({error: 'Veritabanında bir hata oluştu.'});
                } else if (results.length === 0) {
                    console.log('No user found with provided userid.');
                    res.status(404).json({error: 'Geçersiz userid.'});
                } else {
                    console.log('Retrieved records:', results);
                    res.status(200).json(results[0]); // İlk kaydı döndür
                }
            }
        );
    });
});

app.get('/api/user/get/all', (req, res) => {

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'SELECT userid, username, userbio, profilephoto FROM users',
            (err, results) => {
                if (err) {
                    console.error('Error retrieving records:', err);
                    res.status(500).send('Error retrieving records');
                } else {
                    console.log('Retrieved records:', results);
                    res.status(200).send(results);
                }
            }
        );
    });
});

//---------------------------------------------------------chat---------------------------------------------------------
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const targetDirectory = '/var/www/html/uploads/chat/header'; // Klasörün hedef dizini

        // Klasörü oluştur (varsa tekrar oluşturulmayacak)
        fs.mkdirSync(targetDirectory, {recursive: true});

        cb(null, targetDirectory);
    },
    filename: (req, file, cb) => {
        const uniqueId = crypto.randomBytes(4).toString('hex');
        const modifiedFileName = `PCT_${uniqueId}_${file.originalname}`;

        cb(null, modifiedFileName);
    }
});
const upload = multer({storage});

app.post('/api/chat/upload', upload.single('photo'), (req, res) => {
    if (req.file) {
        // Fotoğraf başarıyla yüklendi
        const imageUrl = `http://23.26.248.43/uploads/chat/header/${req.file.filename}`;
        res.json({success: true, imageUrl: imageUrl});
    } else {
        // Fotoğraf yüklenemedi
        res.status(400).json({success: false, message: 'Fotoğraf yüklenemedi.'});
    }
});

app.post('/api/chat/delete/header', (req, res) => {
    const {fileUrl} = req.body;

    // Dosya adını ayıklayarak dosyanın adını elde edin
    const fileName = fileUrl.split('/').pop();

    // Dosyanın bulunduğu dizin
    const targetDirectory = '/var/www/html/uploads/chat/header';

    // Dosya yolunu oluşturun
    const filePath = `${targetDirectory}/${fileName}`;

    // Dosyayı sil
    fs.unlink(filePath, (err) => {
        if (err) {
            console.log('Dosya silinirken bir hata oluştu:', err);
            res.status(500).json({success: false, message: 'Dosya silinirken bir hata oluştu.'});
        } else {
            console.log('Dosya başarıyla silindi:', filePath);
            res.json({success: true, message: 'Dosya başarıyla silindi.'});
        }
    });
});

app.post('/api/chat/update', (req, res) => {
    const {groupName, groupname, groupdes, groupphoto} = req.body;

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'SELECT * FROM chats WHERE groupname = ?',
            [groupName],
            (err, results) => {
                if (err) {
                    console.log('Error querying MySQL:', err);
                    res.status(500).send('Error querying database.');
                } else if (results.length === 0) {
                    console.log('Chat with provided id not found.');
                    res.status(404).send('Chat not found.');
                } else {
                    const chat = results[0];

                    // groupname, groupdes veya groupphoto varsa güncelle
                    if (groupname) chat.groupname = groupname;
                    if (groupdes) chat.groupdes = groupdes;
                    if (groupphoto) chat.groupphoto = groupphoto;

                    getConnectionAndExecute(req, res, (connection) => {
                        connection.query(
                            'UPDATE chats SET groupname = ?, groupdes = ?, groupphoto = ? WHERE groupname = ?',
                            [chat.groupname, chat.groupdes, chat.groupphoto, groupName],
                            (err, results) => {
                                if (err) {
                                    console.log('Error updating chat in MySQL:', err);
                                    res.status(500).send('Error updating chat in database.');
                                } else {
                                    console.log('Chat updated successfully.');
                                    res.status(200).send('Chat updated successfully.');
                                }
                            }
                        );
                    });
                }
            }
        );
    });
});

app.post('/api/chat/newchat', (req, res) => {
    const {adminid, groupphoto, groupname, groupdes} = req.body;

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'SELECT COUNT(*) AS chatCount FROM chats WHERE adminid = ?',
            [adminid],
            (err, results) => {
                if (err) {
                    console.error('Error counting chat records:', err);
                    res.status(500).send('Error counting chat records');
                    return;
                }

                const chatCount = results[0].chatCount;
                if (chatCount >= 10) {
                    console.log('Maximum chat limit reached for admin:', adminid);
                    res.status(403).send({error: 'Maximum chat limit reached for admin'});
                    return;
                }

                getConnectionAndExecute(req, res, (connection) => {
                    connection.query(
                        'INSERT INTO chats (adminid, groupphoto, groupname, groupdes) VALUES (?, ?, ?, ?)',
                        [adminid, groupphoto, groupname, groupdes],
                        (err, results) => {
                            if (err) {
                                if (err.code === 'ER_DUP_ENTRY') {
                                    console.log(`Group already exists with name ${groupname}.`);
                                    res.status(409).send({error: 'Conflict: Group already exists with this name.'});
                                } else {
                                    console.error('Error inserting record:', err);
                                    res.status(500).send('Error inserting record');
                                }
                            } else {
                                console.log('Inserted into MySQL:', results);
                                res.status(200).send('Record inserted successfully');
                            }
                        }
                    );
                });
            }
        );
    });
});

app.post('/api/chat/color', (req, res) => {
    const {groupcolor} = req.body;
    const groupColor = parseInt(groupcolor);

    if (isNaN(groupColor) || groupColor < 1 || groupColor > 5) {
        res.status(400).send({error: 'Invalid color value'});
        return;
    }

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'UPDATE chats SET groupcolor = ?',
            [groupColor],
            (err, results) => {
                if (err) {
                    console.log('Error:', err);
                    res.status(500).send({error: 'Internal Server Error: Please try again later.'});
                } else {
                    console.log('Group color updated:', results);
                    res.status(200).send({message: 'Group color updated successfully'});
                }
            }
        );
    });
});

app.post('/api/chat/groupnametogroupid', (req, res) => {
    const {groupname} = req.body;

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'SELECT groupid FROM chats WHERE groupname = ?', [groupname],
            (err, results) => {
                if (err) {
                    console.error(err);
                    res.status(500).json({error: 'Server error'});
                } else {
                    if (results.length > 0) {
                        const groupid = results[0].groupid;
                        res.status(200).json({groupid: groupid});
                    } else {
                        res.status(404).json({error: 'chat not found'});
                    }
                }
            }
        );
    });
});

app.post('/api/chat/delete', (req, res) => {
    const {groupname, adminid} = req.body;

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'DELETE FROM chats WHERE groupname = ? AND adminid = ?', [groupname, adminid],
            (err, results) => {
                if (err) {
                    console.log('Error querying MySQL:', err);
                    res.status(500).send('Error deleting chat in database.');
                } else if (results.affectedRows === 0) {
                    console.log('No chat found with provided credentials.');
                    //res.status(404).send(`Invalid chat ${groupname} ${adminid}. ${JSON.stringify(results)}`);
                    res.status(404).send(`Invalid chat ${groupname}`);
                } else {
                    console.log('Chat with name ${groupname} deleted successfully.');
                    res.status(200).send('Chat deleted successfully');
                }
            }
        );
    });
});

app.get('/api/chat/get', (req, res) => {
    const adminId = req.query.adminid;
    const groupName = req.query.groupName;

    getConnectionAndExecute(req, res, (connection) => {
        let query = 'SELECT * FROM chats';

        if (adminId) {
            query += ' WHERE adminid = ?';
        } else if (groupName) {
            query += ' WHERE groupName = ?';
        } else {
            res.status(400).send('Invalid parameters');
            return;
        }

        connection.query(
            query,
            [adminId || groupName],
            (err, results) => {
                if (err) {
                    console.error('Error retrieving records:', err);
                    res.status(500).send('Error retrieving records');
                } else {
                    console.log('Retrieved records:', results);
                    res.status(200).send(results);
                }
            }
        );
    });
});

app.get('/api/chat/get/all', (req, res) => {

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'SELECT * FROM chats',
            (err, results) => {
                if (err) {
                    console.error('Error retrieving records:', err);
                    res.status(500).send('Error retrieving records');
                } else {
                    console.log('Retrieved records:', results);
                    res.status(200).send(results);
                }
            }
        );
    });
});

app.get('/api/chat/get/id', (req, res) => {
    const groupId = req.query.groupid; //çalışıyorsa dokunma

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'SELECT * FROM chats WHERE groupid = ?',
            [groupId],
            (err, results) => {
                if (err) {
                    console.error('Error retrieving records:', err);
                    res.status(500).send('Error retrieving records');
                } else {
                    console.log('Retrieved records:', results);
                    res.status(200).send(results);
                }
            }
        );
    });
});

app.get('/api/chat/chat-messages', (req, res) => {
    const page = parseInt(req.query.page) || 1; // Sayfa numarasını al
    const pageSize = parseInt(req.query.pageSize) || 10; // Sayfa boyutunu al
    const startIndex = (page - 1) * pageSize;

    const query = 'SELECT id, groupid, senderid, content, timestamp FROM chat_messages ORDER BY timestamp DESC LIMIT ?, ?';

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(query, [startIndex, pageSize], (err, results) => {
            if (err) {
                console.error('MySQL query error:', err);
                res.status(500).send({error: 'Internal Server Error: Please try again later.'});
            } else {
                console.log('Chat messages retrieved from MySQL:', results);
                res.status(200).send(results);
            }
        });
    });
});

app.post('/api/chat/newmessage', (req, res) => {
    const {groupId, senderid, content, timestamp} = req.body;

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'INSERT INTO chat_messages (groupid, senderid, content, timestamp) VALUES (?, ?, ?, ?)',
            [groupId, senderid, content, timestamp],
            (err, results) => {
                if (err) {
                    console.error('MySQL query error:', err);
                    res.status(500).send({error: 'Internal Server Error: Please try again later.'});
                } else if (results.affectedRows === 0) {
                    console.error('No rows were affected. Check your input data.');
                    res.status(400).send({error: 'Bad Request: Check your input data and try again.'});
                } else {
                    console.log('New chat message added to MySQL:', results);
                    res.status(200).send({message: 'New chat message successfully added.'});
                }
            }
        );
    });
});

//---------------------------------------------------------post---------------------------------------------------------
const storagePost = multer.diskStorage({
    destination: (req, file, cb) => {
        const targetDirectory = '/var/www/html/uploads/post';
        fs.mkdirSync(targetDirectory, {recursive: true});
        cb(null, targetDirectory);
    },
    filename: (req, file, cb) => {
        const uniqueId = crypto.randomBytes(4).toString('hex');
        const modifiedFileName = `PCT_${uniqueId}_${file.originalname}`;
        cb(null, modifiedFileName);
    }
});
const uploadPost = multer({storage: storagePost}).single('photo');

app.post('/api/post/upload', (req, res) => {
    uploadPost(req, res, (err) => {
        if (err) {
            console.log('Error uploading profile photo:', err);
            res.status(400).json({success: false, message: 'Fotoğraf yüklenemedi.'});
        } else {
            const imageUrl = `http://23.26.248.43/uploads/post/${req.file.filename}`;
            res.json({success: true, imageUrl: imageUrl});
        }
    });
});

app.post('/api/post/newpost', (req, res) => {
    const {userid, postphoto, postname, postdes, posttime} = req.body;

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'SELECT * FROM posts WHERE postname = ? AND userid = ?',
            [postname, userid],
            (selectErr, selectResults) => {
                if (selectErr) {
                    console.error('Error selecting record:', selectErr);
                    res.status(500).send('Error selecting record');
                } else {
                    if (selectResults.length > 0) {
                        res.status(400).send('A post with the same name already exists for this user.');
                    } else {

                        getConnectionAndExecute(req, res, (connection) => {
                            connection.query(
                                'INSERT INTO posts (userid, postphoto, postname, postdes, posttime) VALUES (?, ?, ?, ?, ?)',
                                [userid, postphoto, postname, postdes, posttime],
                                (insertErr, insertResults) => {
                                    if (insertErr) {
                                        console.error('Error inserting record:', insertErr);
                                        res.status(500).send('Error inserting record');
                                    } else {
                                        console.log('Inserted into MySQL:', insertResults);
                                        res.status(200).send('Record inserted successfully');
                                    }
                                }
                            );
                        });
                    }
                }
            }
        );
    });
});

app.post('/api/post/delete', (req, res) => {
    const {userid, postname} = req.body;

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'DELETE FROM posts WHERE userid = ? AND postname = ?',
            [userid, postname],
            (err, results) => {
                if (err) {
                    console.error('Error deleting record:', err);
                    res.status(500).send({error: 'Internal Server Error: Please try again later.'});
                } else {
                    if (results.affectedRows > 0) {
                        console.log('Deleted from MySQL:', results);
                        res.status(200).send();
                    } else {
                        console.log('No matching record found.');
                        res.status(404).send({error: 'No matching record found.'});
                    }
                }
            }
        );
    });
});

app.post('/api/post/save', (req, res) => {
    const {postname, userid} = req.body;

    getConnectionAndExecute(req, res, (connection) => {
        // "posts" tablosunda ilgili postu arayın
        connection.query('SELECT postid FROM posts WHERE postname = ?', [postname, userid], (error, results) => {
            if (error) {
                console.error('Sorgu hatası: ' + error.message);
                res.status(500).json({success: false, message: 'Veritabanı hatası'});
            } else {
                if (results.length > 0) {
                    // Post bulundu, postid'yi değişkene kaydet
                    const postid = results[0].postid;

                    // "saves" tablosunda belirtilen postid ve userid ile kayıt var mı kontrol et
                    getConnectionAndExecute(req, res, (connection) => {
                        connection.query('SELECT * FROM saves WHERE postid = ? AND userid = ?', [postid, userid], (error, saveResults) => {
                            if (error) {
                                console.error('Sorgu hatası: ' + error.message);
                                res.status(500).json({success: false, message: 'Veritabanı hatası'});
                            } else {
                                if (saveResults.length > 0) {
                                    // Kayıt varsa, bu kaydı "saves" tablosundan sil
                                    getConnectionAndExecute(req, res, (connection) => {
                                        connection.query('DELETE FROM saves WHERE postid = ? AND userid = ?', [postid, userid], (error) => {
                                            if (error) {
                                                console.error('Silme hatası: ' + error.message);
                                                res.status(500).json({success: false, message: 'Veritabanı hatası'});
                                            } else {
                                                console.log('Kayıt silindi.');
                                                res.json({
                                                    success: true,
                                                    message: 'Gönderi kaydedildi ve kayıt silindi.'
                                                });
                                            }
                                        });
                                    });
                                } else {
                                    // Kayıt yoksa, bu bilgileri "saves" tablosuna ekle
                                    getConnectionAndExecute(req, res, (connection) => {
                                        connection.query('INSERT INTO saves (postid, userid) VALUES (?, ?)', [postid, userid], (error) => {
                                            if (error) {
                                                console.error('Ekleme hatası: ' + error.message);
                                                res.status(500).json({success: false, message: 'Veritabanı hatası'});
                                            } else {
                                                console.log('Yeni kayıt eklendi.');
                                                res.json({
                                                    success: true,
                                                    message: 'Gönderi kaydedildi ve yeni kayıt eklendi.'
                                                });
                                            }
                                        });
                                    });
                                }
                            }
                        });
                    });
                } else {
                    res.status(404).json({success: false, message: 'Belirtilen post bulunamadı.'});
                }
            }
        });
    });
});

app.get('/api/post/savelist', (req, res) => {
    const {userid} = req.query;

    // Kullanıcının kaydedilen gönderi ID'lerini al
    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'SELECT postid FROM saves WHERE userid = ?',
            [userid],
            (err, results) => {
                if (err) {
                    console.error('Error getting saved posts:', err);
                    res.status(500).json({error: 'Error getting saved posts'});
                } else {
                    const postIds = results.map(row => row.postid);

                    // Kullanıcının kaydettiği gönderi ID'lerini kullanarak gönderi bilgilerini al
                    getConnectionAndExecute(req, res, (connection) => {
                        connection.query(
                            'SELECT * FROM posts WHERE postid IN (?)',
                            [postIds],
                            (postErr, postResults) => {
                                if (postErr) {
                                    console.error('Error getting posts:', postErr);
                                    res.status(500).json({error: 'Error getting posts'});
                                } else {
                                    const userIds = postResults.map(row => row.userid);

                                    // Kullanıcı adı ve profil fotoğrafını almak için "users" tablosunu sorgula
                                    connection.query(
                                        'SELECT userid, username, profilephoto FROM users WHERE userid IN (?)',
                                        [userIds],
                                        (userErr, userResults) => {
                                            if (userErr) {
                                                console.error('Error getting user information:', userErr);
                                                res.status(500).json({error: 'Error getting user information'});
                                            } else {
                                                // Gönderi bilgilerini ve kullanıcı bilgilerini birleştirerek sonuçları oluştur
                                                const mergedResults = postResults.map(post => {
                                                    const user = userResults.find(u => u.userid === post.userid);
                                                    return {
                                                        ...post,
                                                        username: user.username,
                                                        profilephoto: user.profilephoto
                                                    };
                                                });
                                                res.status(200).json(mergedResults);
                                            }
                                        }
                                    );
                                }
                            }
                        );
                    });
                }
            }
        );
    });
});

app.get('/api/post/get/page/follows', (req, res) => {
    const {userid, page, pageSize} = req.query;

    const parsedPage = parseInt(page) || 1;
    const parsedPageSize = parseInt(pageSize) || 15;
    const startIndex = (parsedPage - 1) * parsedPageSize;

    // Takip edilen kullanıcıların listesini almak için SQL sorgusu
    const followedUsersQuery = `SELECT followedid FROM follow WHERE followerid = ?;`;

    // Takip edilen kullanıcıların postlarını tarih sırasına göre almak için SQL sorgusu
    const getPostsQuery = `
        SELECT * FROM posts
        WHERE userid IN (SELECT followedid FROM follow WHERE followerid = ?)
        ORDER BY posttime DESC
        LIMIT ?, ?;`; // Tarihe göre azalan sıralama ve sayfalama

    // Takip edilen kullanıcıların listesini al
    getConnectionAndExecute(req, res, (connection) => {
        connection.query(followedUsersQuery, [userid], (err, followedUsers) => {
            if (err) {
                console.error('Takip edilen kullanıcıları alırken bir hata oluştu:', err);
                res.status(500).json({error: 'Sunucu hatası'});
                return;
            }

            // Takip edilen kullanıcıların postlarını al ve sayfalama uygula
            getConnectionAndExecute(req, res, (connection) => {
                connection.query(getPostsQuery, [userid, startIndex, parsedPageSize], (err, posts) => {
                    if (err) {
                        console.error('Takip edilen kullanıcıların postlarını alırken bir hata oluştu:', err);
                        res.status(500).json({error: 'Sunucu hatası'});
                        return;
                    }

                    if (posts.length === 0) {
                        // Eğer sayfa boşsa, boş bir cevap gönder
                        res.status(200).json([]);
                    } else {
                        const userIds = posts.map(post => post.userid);

                        // Kullanıcı adı ve profil fotoğrafını almak için "users" tablosunu sorgula
                        getConnectionAndExecute(req, res, (connection) => {
                            connection.query(
                                'SELECT userid, username, profilephoto FROM users WHERE userid IN (?)',
                                [userIds],
                                (userErr, userResults) => {
                                    if (userErr) {
                                        console.error('Kullanıcı bilgilerini alırken bir hata oluştu:', userErr);
                                        res.status(500).json({error: 'Kullanıcı bilgilerini alırken hata oluştu'});
                                    } else {
                                        // Gönderi bilgilerini ve kullanıcı bilgilerini birleştirerek sonuçları oluştur
                                        const mergedResults = posts.map(post => {
                                            const user = userResults.find(u => u.userid === post.userid);
                                            return {
                                                ...post,
                                                username: user.username,
                                                profilephoto: user.profilephoto
                                            };
                                        });
                                        res.status(200).json(mergedResults);
                                    }
                                }
                            );
                        });
                    }
                });
            });
        });
    });
});

app.get('/api/post/get/all', (req, res) => {
    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'SELECT * FROM posts',
            (err, postResults) => {
                if (err) {
                    console.error('Error retrieving records:', err);
                    res.status(500).send('Error retrieving records');
                } else {
                    if (postResults.length === 0) {
                        // Eğer sayfa boşsa, boş bir cevap gönder
                        res.status(200).json([]);
                    } else {
                        const userIds = postResults.map(row => row.userid);

                        // Kullanıcı adı ve profil fotoğrafını almak için "users" tablosunu sorgula
                        getConnectionAndExecute(req, res, (connection) => {
                            connection.query(
                                'SELECT userid, username, profilephoto FROM users WHERE userid IN (?)',
                                [userIds],
                                (userErr, userResults) => {
                                    if (userErr) {
                                        console.error('Error getting user information:', userErr);
                                        res.status(500).json({error: 'Error getting user information'});
                                    } else {
                                        // Gönderi bilgilerini ve kullanıcı bilgilerini birleştirerek sonuçları oluştur
                                        const mergedResults = postResults.map(post => {
                                            const user = userResults.find(u => u.userid === post.userid);
                                            return {
                                                ...post,
                                                username: user.username,
                                                profilephoto: user.profilephoto
                                            };
                                        });
                                        res.status(200).json(mergedResults);
                                    }
                                }
                            );
                        });
                    }
                }
            }
        );
    });
});

app.get('/api/post/get/page/all', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = 15;
    const startIndex = (page - 1) * pageSize;

    const query = 'SELECT * FROM posts LIMIT ?, ?';

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(query, [startIndex, pageSize], (err, postResults) => {
            if (err) {
                console.error('MySQL query error:', err);
                res.status(500).send({error: 'Internal Server Error: Please try again later.'});
            } else {
                if (postResults.length === 0) {
                    // Eğer sayfa boşsa, boş bir cevap gönder
                    res.status(200).json([]);
                } else {
                    const userIds = postResults.map(row => row.userid);

                    // Kullanıcı adı ve profil fotoğrafını almak için "users" tablosunu sorgula
                    getConnectionAndExecute(req, res, (connection) => {
                        connection.query(
                            'SELECT userid, username, profilephoto FROM users WHERE userid IN (?)',
                            [userIds],
                            (userErr, userResults) => {
                                if (userErr) {
                                    console.error('Error getting user information:', userErr);
                                    res.status(500).json({error: 'Error getting user information'});
                                } else {
                                    // Gönderi bilgilerini ve kullanıcı bilgilerini birleştirerek sonuçları oluştur
                                    const mergedResults = postResults.map(post => {
                                        const user = userResults.find(u => u.userid === post.userid);
                                        return {
                                            ...post,
                                            username: user.username,
                                            profilephoto: user.profilephoto
                                        };
                                    });
                                    res.status(200).json(mergedResults);
                                }
                            }
                        );
                    });
                }
            }
        });
    });
});

app.get('/api/post/get/id', (req, res) => {
    const userid = req.query.userid;

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'SELECT * FROM posts WHERE userid = ?',
            [userid],
            (err, postResults) => {
                if (err) {
                    console.error('Error retrieving records:', err);
                    res.status(500).send('Error retrieving records');
                } else {
                    if (postResults.length === 0) {
                        // Eğer sayfa boşsa, boş bir cevap gönder
                        res.status(200).json([]);
                    } else {
                        const userIds = postResults.map(row => row.userid);

                        // Kullanıcı adı ve profil fotoğrafını almak için "users" tablosunu sorgula
                        getConnectionAndExecute(req, res, (connection) => {
                            connection.query(
                                'SELECT userid, username, profilephoto FROM users WHERE userid IN (?)',
                                [userIds],
                                (userErr, userResults) => {
                                    if (userErr) {
                                        console.error('Error getting user information:', userErr);
                                        res.status(500).json({error: 'Error getting user information'});
                                    } else {
                                        // Gönderi bilgilerini ve kullanıcı bilgilerini birleştirerek sonuçları oluştur
                                        const mergedResults = postResults.map(post => {
                                            const user = userResults.find(u => u.userid === post.userid);
                                            return {
                                                ...post,
                                                username: user.username,
                                                profilephoto: user.profilephoto
                                            };
                                        });
                                        res.status(200).json(mergedResults);
                                    }
                                }
                            );
                        });
                    }
                }
            }
        );
    });
});

app.post('/api/post/like', (req, res) => {
    const { userid, postname, postphoto } = req.body;

    // İlgili postu "posts" tablosunda bul
    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'SELECT postid FROM posts WHERE postname = ? AND postphoto = ?',
            [postname, postphoto],
            (err, results) => {
                if (err) {
                    console.error('Hata:', err);
                    res.status(500).send({ error: 'Internal Server Error: Lütfen daha sonra tekrar deneyin.' });
                } else {
                    if (results.length === 0) {
                        res.status(404).send({ error: 'Belirtilen post bulunamadı.' });
                    } else {
                        const postid = results[0].postid;

                        // "likes" tablosuna kaydet
                        getConnectionAndExecute(req, res, (connection) => {
                            connection.query(
                                'INSERT INTO likes (userid, postid) VALUES (?, ?)',
                                [userid, postid],
                                (err, insertResult) => {
                                    if (err) {
                                        console.error('Hata:', err);
                                        res.status(500).send({ error: 'Internal Server Error: Lütfen daha sonra tekrar deneyin.' });
                                    } else {
                                        console.log('MySQL\'e eklendi:', insertResult);

                                        // "posts" tablosunda "postlike" değerini artır
                                        getConnectionAndExecute(req, res, (connection) => {
                                            connection.query(
                                                'UPDATE posts SET postlike = postlike + 1 WHERE postid = ?',
                                                [postid],
                                                (err, updateResult) => {
                                                    if (err) {
                                                        console.error('Hata:', err);
                                                        res.status(500).send({ error: 'Internal Server Error: Lütfen daha sonra tekrar deneyin.' });
                                                    } else {
                                                        console.log('Post beğenisi artırıldı:', updateResult);
                                                        res.status(200).send();
                                                    }
                                                }
                                            );
                                        });
                                    }
                                }
                            );
                        });
                    }
                }
            }
        );
    });
});

app.post('/api/post/unlike', (req, res) => {
    const { userid, postname, postphoto } = req.body;

    // İlgili postu "posts" tablosunda bul
    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'SELECT postid FROM posts WHERE postname = ? AND postphoto = ?',
            [postname, postphoto],
            (err, results) => {
                if (err) {
                    console.error('Hata:', err);
                    res.status(500).send({ error: 'Internal Server Error: Lütfen daha sonra tekrar deneyin.' });
                } else {
                    if (results.length === 0) {
                        res.status(404).send({ error: 'Belirtilen post bulunamadı.' });
                    } else {
                        const postid = results[0].postid;

                        // "likes" tablosuna kaydet
                        getConnectionAndExecute(req, res, (connection) => {
                            connection.query(
                                'INSERT INTO unlikes (userid, postid) VALUES (?, ?)',
                                [userid, postid],
                                (err, insertResult) => {
                                    if (err) {
                                        console.error('Hata:', err);
                                        res.status(500).send({ error: 'Internal Server Error: Lütfen daha sonra tekrar deneyin.' });
                                    } else {
                                        console.log('MySQL\'e eklendi:', insertResult);

                                        // "posts" tablosunda "postlike" değerini artır
                                        getConnectionAndExecute(req, res, (connection) => {
                                            connection.query(
                                                'UPDATE posts SET postlike = postlike - 1 WHERE postid = ?',
                                                [postid],
                                                (err, updateResult) => {
                                                    if (err) {
                                                        console.error('Hata:', err);
                                                        res.status(500).send({ error: 'Internal Server Error: Lütfen daha sonra tekrar deneyin.' });
                                                    } else {
                                                        console.log('Post beğenisi artırıldı:', updateResult);
                                                        res.status(200).send();
                                                    }
                                                }
                                            );
                                        });
                                    }
                                }
                            );
                        });
                    }
                }
            }
        );
    });
});

//--------------------------------------------------------follow--------------------------------------------------------
app.post('/api/follow/add', (req, res) => {
    const {followerid, followedid} = req.body;

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'INSERT INTO follow (followerid, followedid) VALUES (?, ?)',
            [followerid, followedid],
            (err, results) => {
                if (err) {
                    console.error('MySQL query error:', err);
                    res.status(500).send({error: 'Internal Server Error: Please try again later.'});
                } else if (results.affectedRows === 0) {
                    console.error('No rows were affected. Check your input data.');
                    res.status(400).send({error: 'Bad Request: Check your input data and try again.'});
                } else {
                    console.log('Inserted into MySQL:', results);
                    res.status(200).send();
                }
            }
        );
    });
});

app.post('/api/follow/remove', (req, res) => {
    const {followerid, followedid} = req.body;

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'DELETE FROM follow WHERE followerid = ? AND followedid = ?',
            [followerid, followedid],
            (err, results) => {
                if (err) {
                    console.error('MySQL query error:', err);
                    res.status(500).send({error: 'Internal Server Error: Please try again later.'});
                } else if (results.affectedRows === 0) {
                    console.error('No rows were affected. Check your input data.');
                    res.status(400).send({error: 'Bad Request: Check your input data and try again.'});
                } else {
                    console.log('Deleted from MySQL:', results);
                    res.status(200).send();
                }
            }
        );
    });
});

app.post('/api/follow/get', (req, res) => {
    const {username} = req.body;

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'SELECT userid FROM users WHERE username = ?', [username],
            (err, results) => {
                if (err) {
                    console.error(err);
                    res.status(500).json({error: 'Server error'});
                } else {
                    if (results.length > 0) {
                        const userid = results[0].userid;
                        res.status(200).json({userid: userid});
                    } else {
                        res.status(404).json('User not found');
                    }
                }
            }
        );
    });
});

app.post('/api/follow/followstatus', (req, res) => {
    const followerId = req.body.followerid;

    getConnectionAndExecute(req, res, (connection) => {
        connection.query('SELECT followedid FROM follow WHERE followerid = ?', [followerId],
            (err, results) => {
                if (err) {
                    console.error('Error executing MySQL query:', err);
                    res.status(500).json({error: 'An error occurred while fetching data'});
                } else {
                    const followedIds = results.map(result => result.followedid);
                    res.status(200).json({followedIds: followedIds});
                }
            }
        );
    });
});

app.get('/api/follow/all', (req, res) => {
    const userid = req.query.userid;

    getConnectionAndExecute(req, res, (connection) => {
        connection.query(
            'SELECT ' +
            '(SELECT COUNT(*) FROM follow WHERE followerid = ?) AS followerCount, ' +
            '(SELECT COUNT(*) FROM follow WHERE followedid = ?) AS followedCount',
            [userid, userid],
            (error, results) => {
                if (error) {
                    res.status(500).json({error: 'Veritabanı hatası'});
                } else {
                    const followerCount = results[0].followerCount;
                    const followedCount = results[0].followedCount;
                    res.status(200).json({followerCount, followedCount});
                }
            }
        );
    });
});

// Server'ı başlatma
app.listen(port, () => {
    console.log(`Server started on port ${port}.`);
});
