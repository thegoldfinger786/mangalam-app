import { GitaVerse } from './types';

// Mock audio resource to use for testing
const mockAudio = {
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', // Placeholder audio
    duration: 120, // 2 minutes
};

export const COLLECTION_METADATA: Record<string, { title: string; icon: string; color: string }> = {
    gita: { title: 'Bhagavad Gita', icon: 'book', color: '#E88B4A' },
    ramayan: { title: 'Ramayana', icon: 'navigate', color: '#DE5D3D' },
    mahabharat: { title: 'Mahabharata', icon: 'flash', color: '#D6A621' },
    shiv_puran: { title: 'Shiva Purana', icon: 'moon', color: '#5C7485' },
    upanishads: { title: 'Upanishads', icon: 'leaf', color: '#568E65' },
};

export const gitaVerses: GitaVerse[] = [
    {
        id: 'bg-1-1',
        chapter: 1,
        verse: 1,
        sanskrit: 'धृतराष्ट्र उवाच\nधर्मक्षेत्रे कुरुक्षेत्रे समवेता युयुत्सवः।\nमामकाः पाण्डवाश्चैव किमकुर्वत सञ्जय।।',
        transliteration: 'dhṛtarāṣṭra uvāca\ndharma-kṣetre kuru-kṣetre samavetā yuyutsavaḥ\nmāmakāḥ pāṇḍavāś caiva kim akurvata sañjaya',
        translation: 'This verse means, Dhritarashtra said: O Sanjaya, what did my sons and the sons of Pandu do, when they gathered on the sacred field of Kurukshetra, eager for battle?',
        commentary: 'The opening verse sets the stage for the entire Bhagavad Gita. King Dhritarashtra, blind both physically and spiritually, asks his visionary minister Sanjaya about the events on the battlefield. The word "dharma-kshetre" is significant; it implies a field where duty and righteousness will be tested.',
        dailyLifeApplication: 'Like Dhritarashtra, we often ask about the superficial conflicts in our lives while remaining blind to the deeper universal truths. Today, reflect on a situation where you might be overly attached to "my" side vs "their" side.',
        practicalExamples: [
            'Example 1: Feeling biased in a workplace disagreement because your friend is involved.',
            'Example 2: Prioritizing personal comfort over a common goal in a family setting.'
        ],
        audioEnglishMale: mockAudio,
        audioEnglishFemale: mockAudio,
        audioHindiMale: mockAudio,
        audioHindiFemale: mockAudio,
    },
    {
        id: 'bg-2-14',
        chapter: 2,
        verse: 14,
        sanskrit: 'मात्रास्पर्शास्तु कौन्तेय शीतोष्णसुखदुःखदाः।\nआगमापायिनोऽनित्यास्तांस्तितिक्षस्व भारत।।',
        transliteration: 'mātrā-sparśās tu kaunteya śītoṣṇa-sukha-duḥkha-dāḥ\nāgamāpāyino ’nityās tāṁs titikṣasva bhārata',
        translation: 'This verse means, O son of Kunti, the nonpermanent appearance of happiness and distress, and their disappearance in due course, are like the appearance and disappearance of winter and summer seasons. They arise from sense perception, O scion of Bharata, and one must learn to tolerate them without being disturbed.',
        commentary: 'Krishna explains the transient nature of sensory experiences. Joy and sorrow are as inevitable and passing as the seasons. True wisdom lies in maintaining equanimity amidst these fluctuations.',
        dailyLifeApplication: 'When faced with a sudden setback today, or an unexpected joy, try to observe the feeling without being completely swept away. Acknowledge that this too shall pass.',
        practicalExamples: [
            'Example 1: Remaining calm when a vacation plan gets canceled due to weather.',
            'Example 2: Not getting overly arrogant after receiving praise for a project.'
        ],
        audioEnglishMale: mockAudio,
        audioEnglishFemale: mockAudio,
        audioHindiMale: mockAudio,
        audioHindiFemale: mockAudio,
    },
    {
        id: 'bg-2-47',
        chapter: 2,
        verse: 47,
        sanskrit: 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।\nमा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि।।',
        transliteration: 'karmaṇy evādhikāras te mā phaleṣu kadācana\nmā karma-phala-hetur bhūr mā te saṅgo ’stv akarmaṇi',
        translation: 'This verse means, You have a right to perform your prescribed duty, but you are not entitled to the fruits of action. Never consider yourself the cause of the results of your activities, and never be attached to not doing your duty.',
        commentary: 'Perhaps the most famous verse of the Gita. It teaches Karma Yoga—action without attachment. We control our effort, not the outcome. Attachment to results causes anxiety, while inaction causes stagnation.',
        dailyLifeApplication: 'Focus completely on the process of a task today. Do it as well as you can, and then consciously let go of worrying about how others will judge the result or what reward you might get.',
        practicalExamples: [
            'Example 1: Preparing thoroughly for an exam and then relaxing, knowing you did your best regardless of the grade.',
            'Example 2: Helping someone without expecting a "thank you" or any future favor.'
        ],
        audioEnglishMale: mockAudio,
        audioEnglishFemale: mockAudio,
        audioHindiMale: mockAudio,
        audioHindiFemale: mockAudio,
    }
];

// Helper to get verses by chapter
export const getVersesByChapter = () => {
    const chapters: Record<number, GitaVerse[]> = {};
    gitaVerses.forEach(verse => {
        if (!chapters[verse.chapter]) {
            chapters[verse.chapter] = [];
        }
        chapters[verse.chapter].push(verse);
    });
    return Object.keys(chapters).map(ch => ({
        chapterNumber: Number(ch),
        verses: chapters[Number(ch)],
    }));
};
