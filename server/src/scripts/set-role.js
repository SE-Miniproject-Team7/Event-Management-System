\
    import 'dotenv/config';
    import mongoose from 'mongoose';
    import User from '../models/User.js';

    const [emailArg, roleArg] = process.argv.slice(2);
    const allowed = ['Attendee', 'Organizer', 'Admin'];
    if (!emailArg || !allowed.includes(roleArg)) {
      console.error('Usage: npm run set-role -- user@example.com Organizer|Admin|Attendee');
      process.exit(1);
    }
    try {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ems');
      const user = await User.findOneAndUpdate(
        { email: emailArg.trim().toLowerCase() },
        { role: roleArg },
        { new: true }
      );
      if (!user) {
        console.error('User not found. Register through the UI first.');
        process.exitCode = 1;
      } else {
        console.log(`Updated ${user.email} to role ${user.role}. This script is for local development/admin setup only.`);
      }
    } finally {
      await mongoose.disconnect();
    }
