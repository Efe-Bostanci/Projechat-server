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

// MySQL bağlantısı oluşturmak
const connection = mysql.createConnection({
    host: '77.223.138.139',
    user: 'projech1_kullanici',
    password: 'L6P]hm6(3cSOd9',
    database: 'projech1_data'
});

connection.connect((err) => {
    if (err) {
        console.log('Error connecting to MySQL:', err);
    } else {
        console.log('Connected to MySQL database.');
    }
});

//---------------------------------------------------------user---------------------------------------------------------
app.post('/api/user/signup', (req, res) => {
    // Kullanıcının gönderdiği verileri alın
    const {name, lastname, email, username, userbio, password, profilephoto, twofactor, status} = req.body;
    // Kullanıcının verilerini veritabanına ekleme
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

app.post('/api/user/login', (req, res) => {
    const {email, password} = req.body;

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

app.post('/api/user/login/google', (req, res) => {
    // Kullanıcının gönderdiği verileri alın
    const {email} = req.body;

    // Kullanıcının verilerini veritabanında arama
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

app.post('/api/user/deleteuser', (req, res) => {
    const {username, password} = req.body;

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

app.put('/api/user/changepassword', (req, res) => {
    const {username, password, newpassword} = req.body;

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
    )
});

app.post('/api/user/forgotpassword', (req, res) => {
    const {username, email} = req.body;

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

app.put('/api/user/createpassword', (req, res) => {
    const {username, newPassword} = req.body;

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

app.post('/api/user/update', (req, res) => {
    const {userid, username, userbio, profilephoto} = req.body;

    // Veritabanında chati bul
    connection.query(
        'SELECT * FROM users WHERE username = ?',
        [userid],
        (err, results) => {
            if (err) {
                console.log('Error querying MySQL:', err);
                res.status(500).send('Error querying database.');
            } else if (results.length === 0) {
                console.log('Chat with provided id not found.');
                res.status(404).send('Chat not found.');
            } else {
                const user = results[0];

                // username, userbio veya profilephoto varsa güncelle
                if (username) user.username = username;
                if (userbio) user.userbio = userbio;
                if (profilephoto) user.profilephoto = profilephoto;

                // Güncellenmiş chati veritabanında güncelle
                connection.query(
                    'UPDATE users SET username = ?, userbio = ?, profilephoto = ? WHERE username = ?',
                    [user.username, user.userbio, user.profilephoto, userid],
                    (err, results) => {
                        if (err) {
                            console.log('Error updating user in MySQL:', err);
                            res.status(500).send('Error updating user in database.');
                        } else {
                            console.log('Chat updated successfully.');
                            res.status(200).send('Chat updated successfully.');
                        }
                    }
                );
            }
        }
    );
});

app.post('/api/user/twofactoractive', (req, res) => {
// Kullanıcının gönderdiği verileri alın
    const {username, password} = req.body;
    // Kullanıcının verilerini veritabanında arama ve durumunu 0 olarak güncelleme
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

app.post('/api/user/twofactordeactive', (req, res) => {
    // Kullanıcının gönderdiği verileri alın
    const {username, password} = req.body;

    // Kullanıcının verilerini veritabanında arama ve twofactor değerini 0 olarak güncelleme
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

app.post('/api/user/finduserid', (req, res) => {
    const {email} = req.body;

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

app.post('/api/user/usernametoemail', (req, res) => {
    const {username} = req.body;
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

app.post('/api/user/emailtousername', (req, res) => {
    const {email} = req.body;

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

app.get('/api/user/get', (req, res) => {
    const userId = req.query.userid; //çalışıyorsa dokunma

    connection.query(
        'SELECT username, userbio FROM users WHERE userid = ?',
        [userId],
        (err, results) => {
            if (err) {
                console.error('MySQL sorgu hatası:', err);
                res.status(500).json({ error: 'Veritabanında bir hata oluştu.' });
            } else if (results.length === 0) {
                console.log('No user found with provided userid.');
                res.status(404).json({ error: 'Geçersiz userid.' });
            } else {
                console.log('Retrieved records:', results);
                res.status(200).json(results[0]); // İlk kaydı döndür
            }
        }
    );
});

//---------------------------------------------------------chat---------------------------------------------------------
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const targetDirectory = 'uploads/chat/header'; // Klasörün hedef dizini

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
        const imageUrl = `https://projechats.com/projechat/uploads/chat/header/${req.file.filename}`;
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
    const targetDirectory = 'uploads/chat/header';

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

app.post('/api/chat/newchat', (req, res) => {
    const {adminid, groupphoto, groupname, groupdes} = req.body;

    // Adminin mevcut sohbet sayısını kontrol et
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
        }
    );
});

app.post('/api/chat/groupnametogroupid', (req, res) => {
    const {groupname} = req.body;

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
    )
});

app.post('/api/chat/update', (req, res) => {
    const {groupName, groupname, groupdes, groupphoto} = req.body;

    // Veritabanında chati bul
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

                // Güncellenmiş chati veritabanında güncelle
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
            }
        }
    );
});

app.post('/api/chat/delete', (req, res) => {
    const {groupname, adminid} = req.body;

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

app.get('/api/chat/get', (req, res) => {
    const adminId = req.query.adminid; //çalışıyorsa dokunma

    connection.query(
        'SELECT * FROM chats WHERE adminid = ?',
        [adminId],
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

app.get('/api/chat/get/all', (req, res) => {
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

app.get('/api/chat/get/id', (req, res) => {
    const groupId = req.query.groupid; //çalışıyorsa dokunma

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

app.get('/api/chat/chat-messages', (req, res) => {
    const page = parseInt(req.query.page) || 1; // Sayfa numarasını al
    const pageSize = parseInt(req.query.pageSize) || 10; // Sayfa boyutunu al
    const startIndex = (page - 1) * pageSize;
    const endIndex = page * pageSize;

    // Chats tablosundan belirtilen alanları sorgula ve sayfalı olarak döndür
    const query = 'SELECT groupphoto, groupid, groupname, groupdes FROM chats LIMIT ?, ?';
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

app.post('/api/chat/newmessage', (req, res) => {
    const {groupId, senderid, content, timestamp} = req.body;

    connection.query(
        'INSERT INTO chatmessages (groupid, senderid, content, timestamp) VALUES (?, ?, ?, ?)',
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

// Server'ı başlatma
app.listen(port, () => {
    console.log(`Server started on port ${port}.`);
});