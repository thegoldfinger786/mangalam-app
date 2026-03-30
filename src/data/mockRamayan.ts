import { RamayanEpisode } from './types';

// Mock audio resource to use for testing
const mockAudio = {
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', // Placeholder audio
    duration: 240, // 4 minutes
};

export const ramayanEpisodes: RamayanEpisode[] = [
    {
        id: 'rm-1-1',
        episodeNumber: 1,
        kanda: 'Bala Kanda',
        title: 'The Birth of Rama',
        storySegment: 'King Dasharatha of Ayodhya performed a great yagna (fire sacrifice) wishing for an heir. Out of the sacred fire emerged a divine figure bearing a vessel of sweet pudding (payasam). Dasharatha divided it among his three queens: Kausalya, Kaikeyi, and Sumitra. Soon after, Rama was born to Kausalya, Bharata to Kaikeyi, and the twins Lakshmana and Shatrughna to Sumitra.',
        contextExplanation: 'The yagna symbolizes structured effort mixed with divine grace. The birth of Rama represents the descent of righteousness (dharma) into a world troubled by unrighteousness (Ravana). The division of the offering highlights the unity of Dasharatha’s household.',
        modernApplication: 'In our lives, sincere and structured effort (the yagna), when combined with a larger purpose, brings significant outcomes. Waiting for the right time, as Dasharatha did, requires immense patience.',
        moralTakeaway: 'Patience and pure intent eventually bear fruit.',
        audioEnglishMale: mockAudio,
        audioEnglishFemale: mockAudio,
        audioHindiMale: mockAudio,
        audioHindiFemale: mockAudio,
    },
    {
        id: 'rm-1-2',
        episodeNumber: 2,
        kanda: 'Bala Kanda',
        title: 'Vishwamitra’s Request',
        storySegment: 'The great sage Vishwamitra arrived at Dasharatha’s court. He demanded that the young prince Rama accompany him to the forest to protect his yagna from the demons Maricha and Subahu. Dasharatha was initially terrified to send his young son, but his preceptor Vashistha advised him to trust Vishwamitra’s greater plan.',
        contextExplanation: 'Vishwamitra represents the harsh teacher who challenges the student to unlock their potential. Dasharatha\'s attachment nearly prevented Rama\'s destiny, but wise counsel prevailed.',
        modernApplication: 'Sometimes, mentors or challenges present themselves in ways that seem unreasonable or frightening. Often, stepping out of our comfort zone under guidance is exactly what we need for growth.',
        moralTakeaway: 'Trust the journey of growth, even when it requires stepping into the unknown.',
        audioEnglishMale: mockAudio,
        audioEnglishFemale: mockAudio,
        audioHindiMale: mockAudio,
        audioHindiFemale: mockAudio,
    },
    {
        id: 'rm-2-1',
        episodeNumber: 3,
        kanda: 'Ayodhya Kanda',
        title: 'The Unfulfilled Coronation',
        storySegment: 'Ayodhya rejoiced as Dasharatha announced Rama as the crown prince. However, queen Kaikeyi, manipulated by her maid Manthara, invoked two old boons promised to her by the king. She demanded Bharat be crowned king, and Rama be exiled to the forest for fourteen years. Dasharatha was devastated, but Rama accepted the decision with total calmness.',
        contextExplanation: 'This is a turning point. It contrasts Kaikeyi’s sudden selfishness with Rama’s unwavering equanimity. Rama’s acceptance shows that true leadership is unaffected by the loss of power.',
        modernApplication: 'When sudden reversals of fortune occur—like losing a promotion or facing unexpected hardship—our reaction defines our character. Maintaining grace under profound disappointment is a mark of true strength.',
        moralTakeaway: 'Equanimity in the face of sudden loss is the hallmark of true character.',
        audioEnglishMale: mockAudio,
        audioEnglishFemale: mockAudio,
        audioHindiMale: mockAudio,
        audioHindiFemale: mockAudio,
    }
];
