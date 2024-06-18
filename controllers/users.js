const User = require("../models/users");

class UsersController {
    static async createTableUsers(req, res) {
        try {
            const table = await User.createTableUser();
            res.send(table);
        } catch (error) {
            console.error('Error creating table:', error);
            res.status(500).send('Error creating table.');
        }
    }

    static async createTableUsersFiltered(req, res) {
        try {
            const table = await User.createTableUserFiltered();
            res.send(table);
        } catch (error) {
            console.error('Error creating table:', error);
            res.status(500).send('Error creating table.');
        }
    }

    static async createTableAuth0(req, res) {
        try {
            const table = await User.createTableUserAuth0();
            res.send(table);
        } catch (error) {
            console.error('Error creating table:', error);
            res.status(500).send('Error creating table.');
        }
    }

    static async uploadCSVUserAuth0(req, res) {
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }

        try {
            const fileUpload = await User.uploadCSVUserAuth0(req.file);
            res.send(fileUpload);
        } catch (error) {
            console.error('Error uploading file:', error);
            res.status(500).send('Error uploading file.');
        }
    }

    static async uploadCSVUser(req, res) {
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }

        try {
            const fileUpload = await User.uploadCSVUser(req.file);
            res.send(fileUpload);
        } catch (error) {
            console.error('Error uploading file:', error);
            res.status(500).send('Error uploading file.');
        }
    }

    static async getAllUsers(req, res) {
        try {
            const users = await User.getAllUsers();
            res.json(users);
        } catch (error) {
            console.error('Error fetching users:', error);
            res.status(500).send('Error fetching users.');
        }
    }

    static async auth0Search(req, res) {
        const email = req.query.email;
        if (!email) {
            return res.status(400).send('Email is required.');
        }

        try {
            const user = await User.findMatchingAuth0User(email);
            if (user) {
                res.json(user);
            } else {
                res.status(404).send('User not found in Auth0.');
            }
        } catch (error) {
            console.error('Error fetching user:', error);
            res.status(500).send('Error fetching user.');
        }
    }

    static async search(req, res) {
        const email = req.query.email;
        const dni = req.query.dni;

        if (!email && !dni) {
            return res.status(400).send('Email or DNI is required.');
        }

        try {
            const user = await User.findMatchingUser(email, dni);
            if (user) {
                res.json(user);
            } else {
                res.status(404).send('User not found in MySQL.');
            }
        } catch (error) {
            console.error('Error fetching user:', error);
            res.status(500).send('Error fetching user.');
        }
    }

    static async filterAndFind(req, res) {
        try {
            const users = await User.filterAndFind();
            res.json(users);
        } catch (error) {
            console.error('Error fetching users:', error);
            res.status(500).send('Error fetching users.');
        }
    }

    static async updateMetadata(req, res) {
        try {
            const users = await User.updateMetadata();
            res.json(users);
        } catch (error) {
            console.error('Error fetching users:', error);
            res.status(500).send('Error fetching users.');
        }
    }

    static async updateMetadataGenderAuth0(req, res) {
        try {
            const users = await User.updateMetadataGenderAuth0();
            res.json(users);
        } catch (error) {
            console.error('Error fetching users:', error);
            res.status(500).send('Error fetching users.');
        }
    }

    static async clearTable(req, res) {
        try {
            const table = await User.clearTableUser();
            res.send('Table truncated successfully.');
        } catch (error) {
            console.error('Error truncating table:', error);
            res.status(500).send('Error truncating table.');
        }
    }

    static async clearTableUserFiltered(req, res) {
        try {
            const table = await User.clearTableUserFiltered();
            res.send('Table truncated successfully.');
        } catch (error) {
            console.error('Error truncating table:', error);
            res.status(500).send('Error truncating table.');
        }
    }

    static async clearTableAuth0(req, res) {
        try {
            const table = await User.clearTableAuth0();
            res.send('Table truncated successfully.');
        } catch (error) {
            console.error('Error truncating table:', error);
            res.status(500).send('Error truncating table.');
        }
    }



}
module.exports = UsersController;