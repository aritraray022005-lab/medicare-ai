<div align="center">

# 🏥 MEDICARE AI

**Affordable practice and facility management for independent doctors and small healthcare organizations, with AI-guided patients delivered to their door.**

![Status](https://img.shields.io/badge/status-live-0f8b83?style=for-the-badge)
![For](https://img.shields.io/badge/for-doctors%20%C2%B7%20clinics%20%C2%B7%20patients-1479b8?style=for-the-badge)
![AI](https://img.shields.io/badge/AI-symptom%20guidance-b45f10?style=for-the-badge)

[🌐 Live demo](https://medicare-ai-gules.vercel.app/) &nbsp;·&nbsp; [🩺 For doctors](https://medicare-ai-gules.vercel.app/doctor) &nbsp;·&nbsp; [🏢 For facilities](https://medicare-ai-gules.vercel.app/organization)

</div>

---

## 🎯 The problem

Most healthcare software is built for large hospital chains. For an independent doctor or a small clinic it is too expensive, too complicated and far more than they need. So they fall back on phone calls, paper registers and chat messages.

```mermaid
flowchart LR
    A["📒 Paper registers<br/>📞 Phone calls<br/>💬 Chat messages"] --> B["Double-booked rooms"]
    A --> C["Empty slots"]
    A --> D["Patients can't find<br/>or trust small practices"]
    A --> E["Messy coordination with<br/>visiting doctors"]

    classDef pain fill:#fee2e2,stroke:#b91c1c,color:#7f1d1d
    classDef src fill:#fef3c7,stroke:#b45f10,color:#78350f
    class B,C,D,E pain
    class A src
```

Patients face the other side of the same problem: unclear symptoms, no way to tell who is a verified doctor, and no idea which slots are really open.

## 💡 The solution

MEDICARE AI is one platform where patients, doctors and facilities meet.

```mermaid
flowchart LR
    P["🧑 Patients<br/><b>Free to use</b>"]
    M(["🏥 MEDICARE AI<br/>AI guidance · verified profiles<br/>real availability · management tools"])
    D["🩺 Independent doctors<br/><b>Pay for patient reach</b>"]
    O["🏢 Clinics and organizations<br/><b>Pay for reach and management</b>"]

    P -- "symptoms, questions,<br/>booking requests" --> M
    M -- "ready-to-book patients" --> D
    M -- "ready-to-book patients" --> O
    D -- "pays for visibility<br/>and tools" --> M
    O -- "pays for visibility<br/>and management" --> M

    classDef free fill:#d3f3ee,stroke:#0f8b83,color:#0c2d33
    classDef core fill:#0f8b83,stroke:#0b6e68,color:#ffffff
    classDef doc fill:#dbeafe,stroke:#1479b8,color:#0b2a3f
    classDef org fill:#fde9cf,stroke:#b45f10,color:#3a2105
    class P free
    class M core
    class D doc
    class O org
```

- **Patients** describe how they feel, get AI-guided advice on urgency and the right specialty, and book a real, verified slot.
- **Independent doctors** get a professional profile, a steady flow of patients who are ready to book, and a simple dashboard instead of a notebook.
- **Small clinics and organizations** get the tools to manage rooms, schedules and visiting doctors without paying for an enterprise system.

## 👥 Who it is for

| Audience | What they get | How it works commercially |
| --- | --- | --- |
| 🧑 **Patients** | Free AI symptom guidance, verified doctors, real appointment slots, free expert Q&A | Free to use |
| 🩺 **Independent doctors** | A verified profile, visibility to patients actively looking for care, appointment management | Doctors pay to be listed and to reach new patients |
| 🏢 **Clinics, hospitals and medical centres** | Room scheduling, doctor affiliations and day-to-day management at a fraction of enterprise software cost | Organizations pay for management tools and patient reach |

Patients are the audience. Doctors and facilities are the customers who get paid-for value from reaching them and running their operations in one place.

## 🔄 From "I feel unwell" to a confirmed visit

```mermaid
sequenceDiagram
    autonumber
    actor P as 🧑 Patient
    participant M as 🏥 MEDICARE AI
    actor D as 🩺 Doctor

    P->>M: Describes symptoms in plain words
    M-->>P: Urgency level, likely causes, right specialty
    P->>M: Chooses a verified doctor and an open slot
    M->>D: Booking arrives with reason and symptoms attached
    D-->>P: Verifies the appointment
    Note over P,D: No double-bookings. No phone tag.
```

## ✨ What it does

### 🧑 For patients
- Chat with an **AI health assistant** and run an **AI symptom check** that returns an urgency level, likely causes and the specialty to see.
- Find **admin-verified doctors** and facilities and book from **real availability**.
- Ask health questions and read answers from verified doctors in a free **Q&A** section.

### 🩺 For doctors
- Build a trusted profile verified by our admin team.
- Publish consultation hours and receive bookings that arrive with the patient's reason and symptoms attached.
- Confirm or decline appointments from one dashboard.
- Join facilities and request room time, and answer public questions to build a reputation.

### 🏢 For facilities
- Set up consultation rooms and departments and publish room availability.
- Approve the doctors who practise with you.
- Rooms are booked fairly on a first-come, first-served basis, so **two doctors can never get the same room at the same time**.
- See bookings, requests and appointments in one place.

### 🛡️ Trust and safety
- Every doctor and facility is **verified by an admin** before patients see them.
- Separate, protected access for patients, doctors, facilities and administrators.
- Email verification and secure password recovery.
- Clear guidance that the AI is informational only and is not for emergencies.

## 🚀 Getting started is quick

```mermaid
flowchart LR
    subgraph DOC["🩺 Doctors"]
        direction LR
        d1["Register"] --> d2["Verify email"] --> d3["Admin<br/>verification"] --> d4["Publish<br/>slots"] --> d5["Receive<br/>bookings"]
    end
    subgraph ORG["🏢 Facilities"]
        direction LR
        o1["Register"] --> o2["Verify email"] --> o3["Admin<br/>verification"] --> o4["Add rooms<br/>and doctors"] --> o5["Manage<br/>schedules"]
    end

    classDef doc fill:#dbeafe,stroke:#1479b8,color:#0b2a3f
    classDef org fill:#fde9cf,stroke:#b45f10,color:#3a2105
    class d1,d2,d3,d4,d5 doc
    class o1,o2,o3,o4,o5 org
    style DOC fill:#f8fafc,stroke:#bfdff3,color:#0b2a3f
    style ORG fill:#fffaf3,stroke:#f5d9b6,color:#3a2105
```

## 🏆 Why it stands out

- **Built around a real gap.** It serves small practices that existing software overlooks, with a clear way to pay for itself.
- **Both sides of the market.** Patients bring demand, and doctors and facilities get value, which gives the platform a natural growth loop.
- **Reliable by design.** Scheduling is built so bookings never collide, and expired appointments are cleaned up automatically.
- **Responsible AI.** It helps patients decide what to do next, while keeping real doctors at the centre of care.
- **Complete product, not a demo.** Four user roles, verification workflows, email delivery, Q&A and live deployment.

## 🧰 Built with

React · Node.js · MongoDB · Google Gemini AI

## 🗺️ Roadmap

```mermaid
flowchart LR
    N["✅ Live now<br/>AI guidance · booking<br/>verification · room scheduling · Q&A"]
    X["🔜 Next<br/>Appointment reminders<br/>Doctor reviews and ratings"]
    L["🔭 Later<br/>Multi-language support<br/>Online payments and subscriptions"]
    N --> X --> L

    classDef now fill:#d3f3ee,stroke:#0f8b83,color:#0c2d33
    classDef next fill:#dbeafe,stroke:#1479b8,color:#0b2a3f
    classDef later fill:#fde9cf,stroke:#b45f10,color:#3a2105
    class N now
    class X next
    class L later
```

## ⚠️ Disclaimer

MEDICARE AI provides general health information only. It does not replace advice, diagnosis or treatment from a qualified doctor, and it is not for emergencies. In an emergency, call your local emergency number.

---

<div align="center">

Built by **Aritra Ray**

</div>
