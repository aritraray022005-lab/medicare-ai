require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

async function testAPI() {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: "Say hello in one sentence."
        });

        console.log("API KEY WORKING ✅");
        console.log("Response:", response.text);

    } catch (error) {
        console.log("API KEY FAILED ❌");
        console.log(error.message);
    }
}

testAPI();