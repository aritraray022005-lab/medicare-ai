const cron = require("node-cron");
const Appointment = require("../models/appointment.model");

// Run every minute (or change to '0 * * * *' for hourly)
cron.schedule("* * * * *", async () => {
    try {
        console.log("Running appointment expiry cron job...");
        
        const now = new Date();
        // Reset time to start of day for accurate comparison if date is stored as midnight
        const todayStr = now.toISOString().split('T')[0];
        const currentTimeStr = now.toTimeString().split(' ')[0].substring(0, 5); // HH:mm

        // Find appointments that are still Pending
        const appointments = await Appointment.find({
            status: "Pending" // Or add "Confirmed" if they also expire
        });

        let expiredCount = 0;

        for (let appt of appointments) {
            const apptDateStr = appt.date.toISOString().split('T')[0];
            
            // Check if appointment date is in the past
            if (apptDateStr < todayStr) {
                appt.status = "Expired";
                await appt.save();
                expiredCount++;
            } 
            // If appointment is today, check if time has passed
            else if (apptDateStr === todayStr) {
                if (appt.time < currentTimeStr) {
                    appt.status = "Expired";
                    await appt.save();
                    expiredCount++;
                }
            }
        }

        if (expiredCount > 0) {
            console.log(`Cron job completed. Expired ${expiredCount} appointments.`);
        }

    } catch (error) {
        console.error("Error in appointment expiry cron job:", error);
    }
});
