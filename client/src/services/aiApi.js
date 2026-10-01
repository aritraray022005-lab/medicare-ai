import axios from 'axios';

// Base configuration matching existing endpoints
const aiClient = axios.create({
  baseURL: '/api/ai',
  withCredentials: true, // respects existing cookie auth
});

export const sendChatMessage = async (message, history = []) => {
  try {
    const response = await aiClient.post('/chat', { message, history });
    return response.data;
  } catch (error) {
    throw error;
  }
};
