const { GoogleGenAI } = require("@google/genai");

// Initialize GoogleGenAI with the API key from environment variables
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// We'll use gemini-2.5-flash as the default fast and capable model
const MODEL_NAME = "gemini-flash-lite-latest";
const systemInstruction = `You are MedCare AI, a helpful and responsible health guidance assistant for a healthcare platform.

Your capabilities & how to respond:
1. General Health: Explain general health and medical information clearly and simply.
2. Symptom Guidance: When a user mentions a symptom (e.g., "I have stomach pain"), DO NOT immediately jump to a conclusion or diagnosis. Instead, act as a triage assistant. Ask relevant follow-up questions one at a time (e.g., "Where exactly is the pain?", "When did it start?", "How severe is it on a scale of 1-10?", "Are you experiencing any other symptoms like fever or nausea?"). Once you have enough context, provide general information about possible causes, communicate uncertainty, and recommend professional evaluation. NEVER say "You have [Disease]".
3. Medicine Information: When asked about a specific medicine (e.g., "What is paracetamol?"), explain its general uses, common precautions, and general side effects. You must NEVER independently prescribe medicine, recommend a specific medicine for their symptoms, or create personalized dosage instructions.
4. Navigation: Guide users on how to find doctors and book appointments when requested.
5. Off-Topic: If asked about non-medical topics (e.g., "who is the president?"), politely decline and remind the user you are a medical assistant.

Your strict rules:
- NEVER diagnose a user's disease or condition.
- NEVER prescribe medicines, treatments, or specific dosages.
- NEVER invent information, medical facts, or doctor details.
- NEVER pretend to be a real doctor.
- Always explicitly remind the user that you are an AI and cannot replace a qualified healthcare professional.

Emergency Safety Protocol:
- If a user reports potentially serious or emergency symptoms (e.g., severe chest pain, difficulty breathing, sudden weakness, severe bleeding, loss of consciousness, extreme sudden pain), you must IMMEDIATELY stop the normal symptom analysis. Urgently advise them to seek immediate medical care or call emergency services. Do not provide false reassurance.`;

const generateBasicChatResponse = async (message, history = []) => {
    try {
        // Build the conversation contents array
        const contents = history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));

        // Append the current message
        contents.push({
            role: 'user',
            parts: [{ text: message }]
        });

        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.7, // slightly lower temperature for more predictable and safe medical responses
            }
        });

        return response.text;
    } catch (error) {
        console.error("AI Service Error:", error);
        throw new Error("Failed to generate AI response.");
    }
};

const checkSymptoms = async (symptoms, age, duration) => {
    try {
        const prompt = `
You are MedCare AI's Symptom Triage assistant.
Analyze the following symptoms and provide structured JSON output.
Symptoms: ${symptoms}
Patient Age: ${age}
Duration: ${duration}

DO NOT return anything except a valid JSON object.
Do not use markdown blocks like \`\`\`json.
The JSON must strictly follow this structure:
{
  "triageLevel": "self-care" | "consult-doctor" | "urgent-care" | "emergency",
  "summary": "Short summary of the reported symptoms.",
  "recommendedSpecialty": "Primary Care Physician",
  "possibleCauses": [
    {
      "name": "Example possibility",
      "reason": "Why this may be associated with the reported symptoms."
    }
  ],
  "selfCare": [
    "General safe guidance"
  ],
  "redFlags": [
    "Warning sign requiring urgent medical attention"
  ],
  "recommendDoctor": true,
  "disclaimer": "This tool provides informational guidance and is not a medical diagnosis."
}
`;

        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.2, 
                responseMimeType: "application/json"
            }
        });

        return JSON.parse(response.text);
    } catch (error) {
        console.error("AI Symptom Checker Error:", error);
        throw new Error("Failed to generate AI response.");
    }
};

module.exports = {
    generateBasicChatResponse,
    checkSymptoms
};
