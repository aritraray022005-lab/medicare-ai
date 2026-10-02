import api from '../axios';

export const sendChatMessage = async (message, history = []) => {
  try {
    const response = await api.post('/api/ai/chat', { message, history });
    return response.data;
  } catch (error) {
    throw error;
  }
};
