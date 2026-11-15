const { getAppointmentWindow, getQrAvailability } = require("./appointmentLifecycle.util");

/**
 * Patient-facing projection of an appointment.
 *
 * This is an allow-list: only the fields below ever leave the server for a
 * patient. In particular room, roomSlot, roomBooking, floor, QR hash/nonce and
 * every other internal allocation field are NEVER included.
 */

const idOf = (ref) => {
    if (!ref) return null;
    if (ref._id) return ref._id;
    return ref;
};

function toPatientDoctorView(doctor, { includeClinicLocation = false } = {}) {
    if (!doctor) return null;

    // Un-populated reference (ObjectId)
    if (!doctor.name && !doctor.specialization) {
        return { _id: idOf(doctor) };
    }

    const view = {
        _id: doctor._id,
        name: doctor.name,
        specialization: doctor.specialization,
        qualification: doctor.qualification,
        experience: doctor.experience,
        bio: doctor.bio,
        profilePicture: doctor.profilePicture,
        consultationFee: doctor.consultationFee,
        rating: doctor.rating,
        reviewCount: doctor.reviewCount
    };

    if (includeClinicLocation) {
        view.location = doctor.location;
        view.clinicLocation = doctor.clinicLocation;
    }

    return view;
}

function toPatientOrganizationView(org) {
    if (!org) return null;
    if (!org.name) {
        return { _id: idOf(org) };
    }
    return {
        _id: org._id,
        name: org.name,
        phone: org.phone,
        address: org.address,
        timezone: org.timezone
    };
}

function toPatientAppointmentView(appt, now = new Date()) {
    if (!appt) return null;
    const src = typeof appt.toObject === "function" ? appt.toObject() : appt;
    const isOrg = src.bookingType === "Organization";
    const { end } = getAppointmentWindow(src);

    // Same backend rule as GET /qr: Confirmed + today's local date in the facility
    // timezone + slot END not passed. No before-start restriction.
    const orgTimezone = src.organization && typeof src.organization === "object" ? src.organization.timezone : null;
    const qrAvailable = getQrAvailability(src, now, orgTimezone).available;

    return {
        _id: src._id,
        bookingType: src.bookingType,
        status: src.status,
        date: src.date,
        time: src.time,
        startDateTime: src.startDateTime || null,
        endDateTime: src.endDateTime || null,
        timezone: src.timezone || null,
        reason: src.reason,
        doctor: toPatientDoctorView(src.doctor, { includeClinicLocation: !isOrg }),
        organization: isOrg ? toPatientOrganizationView(src.organization) : null,
        cancellationReason: src.cancellationReason || null,
        cancelledBy: src.cancelledBy || null,
        cancelledAt: src.cancelledAt || null,
        checkedInAt: src.checkedInAt || null,
        queueNumber: src.queueNumber || null,
        completedAt: src.completedAt || null,
        missedAt: src.missedAt || null,
        qr: isOrg
            ? { available: qrAvailable, expiresAt: qrAvailable ? end : null }
            : null,
        createdAt: src.createdAt,
        updatedAt: src.updatedAt
    };
}

module.exports = {
    toPatientAppointmentView,
    toPatientDoctorView,
    toPatientOrganizationView
};
