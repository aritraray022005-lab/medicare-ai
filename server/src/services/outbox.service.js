const OutboxNotification = require("../models/outboxNotification.model");

/**
 * Formats notification email subject, text, and HTML based on notification type and payload.
 *
 * @param {string} type Notification type
 * @param {Object} payload Payload metadata
 * @returns {{ subject: string, text: string, html: string }}
 */
function formatEmailContent(type, payload = {}) {
    const appName = "MEDCARE AI";

    switch (type) {
        case "APPOINTMENT_CONFIRMED":
            return {
                subject: `Appointment Confirmed - ${appName}`,
                text: `Dear ${payload.patientName || "Patient"},\n\nYour appointment with Dr. ${payload.doctorName || "Doctor"} on ${payload.date || "scheduled date"} at ${payload.time || "scheduled time"} has been confirmed.\n\nThank you,\n${appName} Team`,
                html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #2b6cb0;">Appointment Confirmed</h2>
                    <p>Dear <strong>${payload.patientName || "Patient"}</strong>,</p>
                    <p>Your appointment has been successfully confirmed.</p>
                    <div style="background-color: #f7fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Doctor:</strong> Dr. ${payload.doctorName || "Doctor"}</p>
                        <p style="margin: 5px 0;"><strong>Date:</strong> ${payload.date || "Scheduled Date"}</p>
                        <p style="margin: 5px 0;"><strong>Time:</strong> ${payload.time || "Scheduled Time"}</p>
                        ${payload.venue ? `<p style="margin: 5px 0;"><strong>Venue:</strong> ${payload.venue}</p>` : ""}
                    </div>
                    <p style="color: #718096; font-size: 14px;">If you need to reschedule or cancel, please visit your patient dashboard.</p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #a0aec0;">${appName} Automated Notification System</p>
                </div>`
            };

        case "APPOINTMENT_CANCELLED":
            return {
                subject: `Appointment Cancelled - ${appName}`,
                text: `Dear ${payload.patientName || "Patient"},\n\nYour appointment (ID: ${payload.appointmentId || "N/A"}) has been cancelled.\nReason: ${payload.reason || "Administrative or doctor cancellation"}.\n\nThank you,\n${appName} Team`,
                html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #c53030;">Appointment Cancelled</h2>
                    <p>Dear <strong>${payload.patientName || "Patient"}</strong>,</p>
                    <p>We regret to inform you that your scheduled appointment has been cancelled.</p>
                    <div style="background-color: #fff5f5; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #e53e3e;">
                        <p style="margin: 5px 0;"><strong>Reason:</strong> ${payload.reason || "Facility room reservation cancelled"}</p>
                        ${payload.appointmentId ? `<p style="margin: 5px 0;"><strong>Appointment Reference:</strong> ${payload.appointmentId}</p>` : ""}
                    </div>
                    <p style="color: #718096; font-size: 14px;">Please log in to your dashboard to select another time slot or facility.</p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #a0aec0;">${appName} Automated Notification System</p>
                </div>`
            };

        case "APPOINTMENT_CREATED":
            return {
                subject: `New Appointment Booking - ${appName}`,
                text: `Dear ${payload.recipientName || "Healthcare User"},\n\nAn appointment has been scheduled:\nDoctor: Dr. ${payload.doctorName || "Doctor"}\nPatient: ${payload.patientName || "Patient"}\nDate: ${payload.date || "Scheduled Date"}\nTime: ${payload.time || "Scheduled Time"}\n${payload.venue ? "Venue: " + payload.venue + "\n" : ""}\nThank you,\n${appName} Team`,
                html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #2b6cb0;">New Appointment Scheduled</h2>
                    <p>Dear <strong>${payload.recipientName || "Healthcare User"}</strong>,</p>
                    <p>A new appointment has been scheduled successfully.</p>
                    <div style="background-color: #f7fafc; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #3182ce;">
                        <p style="margin: 5px 0;"><strong>Doctor:</strong> Dr. ${payload.doctorName || "Doctor"}</p>
                        <p style="margin: 5px 0;"><strong>Patient:</strong> ${payload.patientName || "Patient"}</p>
                        <p style="margin: 5px 0;"><strong>Date:</strong> ${payload.date || "Scheduled Date"}</p>
                        <p style="margin: 5px 0;"><strong>Time:</strong> ${payload.time || "Scheduled Time"}</p>
                        ${payload.venue ? `<p style="margin: 5px 0;"><strong>Venue:</strong> ${payload.venue}</p>` : ""}
                    </div>
                    <p style="color: #718096; font-size: 14px;">Please check your dashboard for further details.</p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #a0aec0;">${appName} Automated Notification System</p>
                </div>`
            };

        case "APPOINTMENT_REJECTED":
            return {
                subject: `Appointment Request Declined - ${appName}`,
                text: `Dear ${payload.patientName || "Patient"},\n\nYour appointment request with Dr. ${payload.doctorName || "Doctor"} on ${payload.date || "Scheduled Date"} could not be confirmed.\nReason: ${payload.reason || "Doctor unavailable"}.\n\nThank you,\n${appName} Team`,
                html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #c53030;">Appointment Request Declined</h2>
                    <p>Dear <strong>${payload.patientName || "Patient"}</strong>,</p>
                    <p>Your appointment request could not be confirmed by the doctor.</p>
                    <div style="background-color: #fff5f5; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #e53e3e;">
                        <p style="margin: 5px 0;"><strong>Reason:</strong> ${payload.reason || "Doctor unavailable at requested time"}</p>
                    </div>
                    <p style="color: #718096; font-size: 14px;">Please visit your dashboard to select another time slot or practitioner.</p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #a0aec0;">${appName} Automated Notification System</p>
                </div>`
            };

        case "ROOM_BOOKING_ALLOCATED":
            return {
                subject: `Facility Room Allocated - ${appName}`,
                text: `Dear Dr. ${payload.doctorName || "Doctor"},\n\nYour room reservation request for Room ${payload.roomNumber || "N/A"} on ${payload.date || "Date"} from ${payload.startTime || ""} to ${payload.endTime || ""} has been allocated successfully.\n\n${appName} Team`,
                html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #2b6cb0;">Room Booking Allocated</h2>
                    <p>Dear Dr. <strong>${payload.doctorName || "Doctor"}</strong>,</p>
                    <p>Your room booking queue request was approved and allocated.</p>
                    <div style="background-color: #f7fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Organization:</strong> ${payload.organizationName || "Hospital / Clinic"}</p>
                        <p style="margin: 5px 0;"><strong>Room:</strong> ${payload.roomNumber || "N/A"}</p>
                        <p style="margin: 5px 0;"><strong>Schedule:</strong> ${payload.date || ""} ${payload.startTime || ""} - ${payload.endTime || ""}</p>
                    </div>
                    <p style="font-size: 12px; color: #a0aec0;">${appName} Automated Notification System</p>
                </div>`
            };

        case "ROOM_BOOKING_REQUESTED":
            return {
                subject: `Room Booking Request Queued - ${appName}`,
                text: `Dear Dr. ${payload.doctorName || "Doctor"},\n\nYour room reservation request for Room ${payload.roomNumber || "N/A"} on ${payload.date || "Date"} from ${payload.startTime || ""} to ${payload.endTime || ""} has been received and queued (Sequence #${payload.sequenceNumber || 1}).\n\n${appName} Team`,
                html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #2b6cb0;">Room Booking Request Queued</h2>
                    <p>Dear Dr. <strong>${payload.doctorName || "Doctor"}</strong>,</p>
                    <p>Your room booking request has been entered into the server queue.</p>
                    <div style="background-color: #f7fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Organization:</strong> ${payload.organizationName || "Hospital / Clinic"}</p>
                        <p style="margin: 5px 0;"><strong>Room:</strong> ${payload.roomNumber || "N/A"}</p>
                        <p style="margin: 5px 0;"><strong>Schedule:</strong> ${payload.date || ""} ${payload.startTime || ""} - ${payload.endTime || ""}</p>
                        <p style="margin: 5px 0;"><strong>Queue Sequence:</strong> #${payload.sequenceNumber || 1}</p>
                    </div>
                    <p style="font-size: 12px; color: #a0aec0;">${appName} Automated Notification System</p>
                </div>`
            };

        case "ROOM_BOOKING_REJECTED":
            return {
                subject: `Room Booking Request Update - ${appName}`,
                text: `Dear Dr. ${payload.doctorName || "Doctor"},\n\nYour room reservation request for Room ${payload.roomNumber || "N/A"} on ${payload.date || "Date"} could not be allocated.\nReason: ${payload.reason || "Slot unavailable or conflict detected"}.\n\n${appName} Team`,
                html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #c53030;">Room Booking Request Not Allocated</h2>
                    <p>Dear Dr. <strong>${payload.doctorName || "Doctor"}</strong>,</p>
                    <p>We regret to inform you that your room booking request could not be completed.</p>
                    <div style="background-color: #fff5f5; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #e53e3e;">
                        <p style="margin: 5px 0;"><strong>Room:</strong> ${payload.roomNumber || "N/A"}</p>
                        <p style="margin: 5px 0;"><strong>Reason:</strong> ${payload.reason || "Slot unavailable or schedule conflict"}</p>
                    </div>
                    <p style="font-size: 12px; color: #a0aec0;">${appName} Automated Notification System</p>
                </div>`
            };

        case "ROOM_BOOKING_CANCELLED":
            return {
                subject: `Room Booking Cancelled - ${appName}`,
                text: `Dear Healthcare Professional,\n\nThe room booking for Room ${payload.roomNumber || "N/A"} on ${payload.date || "Date"} from ${payload.startTime || ""} to ${payload.endTime || ""} has been cancelled.\nReason: ${payload.reason || "Booking cancelled"}.\n\n${appName} Team`,
                html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #c53030;">Room Booking Cancelled</h2>
                    <p>The facility room reservation has been cancelled.</p>
                    <div style="background-color: #fff5f5; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #e53e3e;">
                        <p style="margin: 5px 0;"><strong>Room:</strong> ${payload.roomNumber || "N/A"}</p>
                        <p style="margin: 5px 0;"><strong>Schedule:</strong> ${payload.date || ""} ${payload.startTime || ""} - ${payload.endTime || ""}</p>
                        <p style="margin: 5px 0;"><strong>Cancellation Reason:</strong> ${payload.reason || "Administrative cancellation"}</p>
                    </div>
                    <p style="font-size: 12px; color: #a0aec0;">${appName} Automated Notification System</p>
                </div>`
            };

        case "ROOM_AVAILABILITY_CHANGED":
            return {
                subject: `Room Availability Updated - ${appName}`,
                text: `Dear Healthcare Partner,\n\nAvailability for Room ${payload.roomNumber || "N/A"} on ${payload.date || "Date"} has been updated: ${payload.details || "Schedule modified"}.\n\n${appName} Team`,
                html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #2b6cb0;">Room Availability Updated</h2>
                    <p>Room availability has been updated.</p>
                    <div style="background-color: #f7fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Room:</strong> ${payload.roomNumber || "N/A"}</p>
                        <p style="margin: 5px 0;"><strong>Details:</strong> ${payload.details || "Availability interval modified"}</p>
                    </div>
                    <p style="font-size: 12px; color: #a0aec0;">${appName} Automated Notification System</p>
                </div>`
            };

        case "AFFILIATION_REQUESTED":
            return {
                subject: `New Doctor Affiliation Request - ${appName}`,
                text: `Dear ${payload.organizationName || "Healthcare Partner"},\n\nDr. ${payload.doctorName || "Doctor"} (${payload.specialization || "Specialist"}) has submitted an affiliation request with your facility.\n\nPlease log in to your organization dashboard to review their credentials.\n\n${appName} Team`,
                html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #2b6cb0;">New Affiliation Request</h2>
                    <p>Dear <strong>${payload.organizationName || "Healthcare Partner"}</strong>,</p>
                    <p>A new affiliation request has been submitted for your facility.</p>
                    <div style="background-color: #f7fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Doctor:</strong> Dr. ${payload.doctorName || "Doctor"}</p>
                        <p style="margin: 5px 0;"><strong>Specialization:</strong> ${payload.specialization || "General"}</p>
                    </div>
                    <p style="color: #718096; font-size: 14px;">Log in to your organization dashboard to review professional credentials and respond.</p>
                    <p style="font-size: 12px; color: #a0aec0;">${appName} Automated Notification System</p>
                </div>`
            };

        case "AFFILIATION_APPROVED":
            return {
                subject: `Doctor Affiliation Approved - ${appName}`,
                text: `Dear Dr. ${payload.doctorName || "Doctor"},\n\nYour affiliation request with ${payload.organizationName || "the organization"} has been approved.\n\n${appName} Team`,
                html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #2f855a;">Affiliation Approved</h2>
                    <p>Dear Dr. <strong>${payload.doctorName || "Doctor"}</strong>,</p>
                    <p>Your affiliation with <strong>${payload.organizationName || "the organization"}</strong> has been officially approved. You can now request room reservations and conduct consultations at this facility.</p>
                    <p style="font-size: 12px; color: #a0aec0;">${appName} Automated Notification System</p>
                </div>`
            };

        case "AFFILIATION_REJECTED":
            return {
                subject: `Doctor Affiliation Request Update - ${appName}`,
                text: `Dear Dr. ${payload.doctorName || "Doctor"},\n\nYour affiliation request with ${payload.organizationName || "the organization"} was not approved.\nReason: ${payload.reason || "Affiliation criteria not met"}.\n\n${appName} Team`,
                html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #c53030;">Affiliation Request Not Approved</h2>
                    <p>Dear Dr. <strong>${payload.doctorName || "Doctor"}</strong>,</p>
                    <p>Your affiliation request with <strong>${payload.organizationName || "the organization"}</strong> has been rejected.</p>
                    <div style="background-color: #fff5f5; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #e53e3e;">
                        <p style="margin: 0;"><strong>Reason:</strong> ${payload.reason || "Affiliation criteria not met"}</p>
                    </div>
                    <p style="color: #718096; font-size: 14px;">You may re-apply to this or other verified healthcare organizations from your doctor dashboard.</p>
                    <p style="font-size: 12px; color: #a0aec0;">${appName} Automated Notification System</p>
                </div>`
            };

        case "AFFILIATION_WITHDRAWN":
            return {
                subject: `Doctor Affiliation Request Withdrawn - ${appName}`,
                text: `Dear ${payload.organizationName || "Healthcare Partner"},\n\nDr. ${payload.doctorName || "Doctor"} has withdrawn their pending affiliation request with your facility.\n\n${appName} Team`,
                html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #718096;">Affiliation Request Withdrawn</h2>
                    <p>Dear <strong>${payload.organizationName || "Healthcare Partner"}</strong>,</p>
                    <p>Dr. <strong>${payload.doctorName || "Doctor"}</strong> has withdrawn their pending affiliation request with your facility.</p>
                    <p style="font-size: 12px; color: #a0aec0;">${appName} Automated Notification System</p>
                </div>`
            };

        case "AFFILIATION_REVOKED":
            return {
                subject: `Doctor Affiliation Terminated - ${appName}`,
                text: `Dear Dr. ${payload.doctorName || "Doctor"},\n\nYour affiliation with ${payload.organizationName || "the organization"} has been revoked.\n${payload.reason ? "Reason: " + payload.reason + "\n" : ""}\n${appName} Team`,
                html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #c53030;">Affiliation Terminated</h2>
                    <p>Dear Dr. <strong>${payload.doctorName || "Doctor"}</strong>,</p>
                    <p>Your affiliation with <strong>${payload.organizationName || "the organization"}</strong> has been revoked.</p>
                    ${payload.reason ? `<div style="background-color: #fff5f5; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #e53e3e;"><p style="margin: 0;"><strong>Reason:</strong> ${payload.reason}</p></div>` : ""}
                    <p style="color: #718096; font-size: 14px;">Facility room reservation privileges for this organization have been discontinued.</p>
                    <p style="font-size: 12px; color: #a0aec0;">${appName} Automated Notification System</p>
                </div>`
            };

        case "AFFILIATION_ADMIN_RESOLVED":
            return {
                subject: `Affiliation Administrative Resolution - ${appName}`,
                text: `Dear Healthcare Partner,\n\nThe affiliation between Dr. ${payload.doctorName || "Doctor"} and ${payload.organizationName || "the organization"} has been administratively resolved.\nAction: ${payload.action || "Resolved"}\n${payload.reason ? "Reason: " + payload.reason + "\n" : ""}\n${appName} Team`,
                html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #2b6cb0;">Administrative Resolution</h2>
                    <p>The affiliation request between Dr. <strong>${payload.doctorName || "Doctor"}</strong> and <strong>${payload.organizationName || "the organization"}</strong> has been resolved by MedCare AI Administration.</p>
                    <div style="background-color: #f7fafc; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #3182ce;">
                        <p style="margin: 5px 0;"><strong>Resolution Action:</strong> ${payload.action || "Resolved"}</p>
                        ${payload.reason ? `<p style="margin: 5px 0;"><strong>Details / Reason:</strong> ${payload.reason}</p>` : ""}
                    </div>
                    <p style="font-size: 12px; color: #a0aec0;">${appName} Automated Notification System</p>
                </div>`
            };

        case "ORGANIZATION_APPROVED":
            return {
                subject: `Organization Approved - ${appName}`,
                text: `Dear ${payload.organizationName || "Healthcare Partner"},\n\nYour organization registration has been approved by MedCare AI Admin. You may now access the verified healthcare network.\n\nThank you,\n${appName} Team`,
                html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #2f855a;">Organization Approved</h2>
                    <p>Dear <strong>${payload.organizationName || "Healthcare Partner"}</strong>,</p>
                    <p>Your organization account has been reviewed and officially approved by MedCare AI Admin.</p>
                    <div style="background-color: #f0fff4; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #38a169;">
                        <p style="margin: 0;"><strong>Status:</strong> Approved & Verified Partner</p>
                    </div>
                    <p style="color: #718096; font-size: 14px;">You can now manage facility rooms, review doctor affiliations, and receive appointment allocations.</p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #a0aec0;">${appName} Automated Notification System</p>
                </div>`
            };

        case "ORGANIZATION_REJECTED":
            return {
                subject: `Organization Registration Update - ${appName}`,
                text: `Dear ${payload.organizationName || "Healthcare Partner"},\n\nYour organization registration was not approved.\nReason: ${payload.reason || "Requirements not met"}.\n\nThank you,\n${appName} Team`,
                html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #c53030;">Registration Update</h2>
                    <p>Dear <strong>${payload.organizationName || "Healthcare Partner"}</strong>,</p>
                    <p>We are unable to approve your organization registration at this time.</p>
                    <div style="background-color: #fff5f5; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #e53e3e;">
                        <p style="margin: 0;"><strong>Reason:</strong> ${payload.reason || "Verification requirements could not be confirmed."}</p>
                    </div>
                    <p style="color: #718096; font-size: 14px;">Please contact MedCare AI support if you have questions or require re-examination.</p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #a0aec0;">${appName} Automated Notification System</p>
                </div>`
            };

        case "ORGANIZATION_BLOCKED":
            return {
                subject: `Organization Account Suspended - ${appName}`,
                text: `Dear ${payload.organizationName || "Healthcare Partner"},\n\nYour organization account has been suspended by MedCare AI Admin.\nReason: ${payload.reason || "Administrative review"}.\n\n${appName} Team`,
                html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #c53030;">Account Suspended</h2>
                    <p>Dear <strong>${payload.organizationName || "Healthcare Partner"}</strong>,</p>
                    <p>Your organization access to MedCare AI has been temporarily suspended.</p>
                    <div style="background-color: #fff5f5; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #e53e3e;">
                        <p style="margin: 0;"><strong>Status:</strong> Suspended / Blocked</p>
                        ${payload.reason ? `<p style="margin: 5px 0 0 0;"><strong>Reason:</strong> ${payload.reason}</p>` : ""}
                    </div>
                    <p style="color: #718096; font-size: 14px;">All active facility operations are paused until further notice.</p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #a0aec0;">${appName} Automated Notification System</p>
                </div>`
            };

        case "ORGANIZATION_UNBLOCKED":
            return {
                subject: `Organization Account Restored - ${appName}`,
                text: `Dear ${payload.organizationName || "Healthcare Partner"},\n\nYour organization account suspension has been lifted by MedCare AI Admin.\n\n${appName} Team`,
                html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #2f855a;">Account Restored</h2>
                    <p>Dear <strong>${payload.organizationName || "Healthcare Partner"}</strong>,</p>
                    <p>Your organization account suspension has been lifted. You can now access all verified organization services.</p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #a0aec0;">${appName} Automated Notification System</p>
                </div>`
            };

        default:
            return {
                subject: payload.subject || `Notification from ${appName}`,
                text: payload.text || `You have a new notification from ${appName}.`,
                html: payload.html || `<p>${payload.text || "You have a new notification from " + appName + "."}</p>`
            };
    }
}

/**
 * Inserts an outbox notification atomically within an existing database transaction session.
 *
 * @param {Object} params
 * @param {string} params.recipientEmail
 * @param {string} params.type
 * @param {Object} [params.payload]
 * @param {mongoose.ClientSession} [params.session]
 * @returns {Promise<Object>}
 */
async function queueNotification({ recipientEmail, type, payload = {} }, session = null) {
    if (!recipientEmail || typeof recipientEmail !== "string") {
        throw new Error("recipientEmail is required for outbox notification");
    }
    if (!type || typeof type !== "string") {
        throw new Error("type is required for outbox notification");
    }

    const doc = {
        recipientEmail: recipientEmail.trim().toLowerCase(),
        type,
        payload,
        status: "PENDING",
        retryCount: 0,
        expireAt: null
    };

    const options = session ? { session } : {};
    const [created] = await OutboxNotification.create([doc], options);
    return created;
}

/**
 * Dispatches an email using the underlying email client (Gmail API or injected sender).
 *
 * @param {Object} notification
 * @param {Object} [options]
 * @param {Function} [options.senderOverride] Optional sender override for testing or custom transports
 * @returns {Promise<Object>}
 */
async function dispatchNotification(notification, options = {}) {
    const { recipientEmail, type, payload } = notification;
    const { subject, text, html } = formatEmailContent(type, payload);

    if (options.senderOverride && typeof options.senderOverride === "function") {
        return await options.senderOverride({ to: recipientEmail, subject, text, html });
    }

    // Use default otpUtil.sendEmail (Google Gmail API)
    const otpUtil = require("../util/otp.util");
    return await otpUtil.sendEmail(recipientEmail, subject, text, html);
}

module.exports = {
    queueNotification,
    formatEmailContent,
    dispatchNotification
};
