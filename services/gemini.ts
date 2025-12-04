import { GoogleGenAI, Type } from "@google/genai";

// Initialize AI client
// Accessing VITE_GEMINI_API_KEY as configured in Vercel/Vite environment
const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.error("Error: VITE_GEMINI_API_KEY is missing. Please add it to your environment variables.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

const fileToBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // split(',') to remove the data URL prefix (e.g. "data:image/png;base64,")
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const generateSessionContent = async (topic: string, type: 'description' | 'quiz'): Promise<string> => {
  let prompt = "";
  
  if (type === 'description') {
    prompt = `Create a short, engaging description for a physical education session about "${topic}". Include 3 key learning objectives. Keep it under 150 words.`;
  } else {
    prompt = `Create 3 multiple choice exam questions for a PE class session about "${topic}". Include the correct answer. Format as simple text.`;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "No content generated.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return "Failed to generate content. Please check your API key.";
  }
};

export const extractStudentNamesFromImage = async (imageFile: File): Promise<string[]> => {
  const base64Data = await fileToBase64(imageFile);
  const prompt = "Extract the list of student names from this image. Return ONLY the names, one per line. Do not include numbers, grades, dates, or headers. Just the First and Last names.";
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: imageFile.type,
              data: base64Data
            }
          },
          { text: prompt }
        ]
      }
    });
    
    const text = response.text || "";
    return text.split('\n').map(name => name.trim()).filter(name => name.length > 0);
  } catch (error: any) {
    console.error("Gemini Vision Error:", error);
    throw new Error("Failed to extract names from image. Please check your API key.");
  }
};

export const extractGradesFromImage = async (imageFile: File): Promise<any[]> => {
  const base64Data = await fileToBase64(imageFile);
  const prompt = `
    Analyze this image of a grade sheet (handwritten or printed). 
    Extract the student names and their scores for Term 1, Term 2, and Term 3 (if available).
    If a note is missing, use 0.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: imageFile.type,
              data: base64Data
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              note1: { type: Type.NUMBER },
              note2: { type: Type.NUMBER },
              note3: { type: Type.NUMBER },
            },
            propertyOrdering: ["name", "note1", "note2", "note3"],
            required: ["name"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];

    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Grade Extraction Error:", error);
    throw new Error("Failed to extract grades from image.");
  }
};