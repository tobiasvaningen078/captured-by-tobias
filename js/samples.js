// Voorbeeldvragen om mee te beginnen. Pas ze aan of vul aan met vragen over jullie werk!
export const SAMPLE_QUESTIONS = [
  {
    type: "mc", time: 20, double: false,
    text: "Welk land schenkt Londen elk jaar de grote kerstboom op Trafalgar Square?",
    options: ["Zweden", "Noorwegen", "Denemarken", "Finland"], correct: 1,
  },
  {
    type: "tf", time: 15, double: false,
    text: "De Kerstman is voor een deel gebaseerd op Sint-Nicolaas.",
    correct: 0,
  },
  {
    type: "estimate", time: 30, double: false,
    text: "Hoeveel cadeaus krijg je in totaal in het liedje 'The Twelve Days of Christmas'?",
    correct: 364, unit: "cadeaus",
  },
  {
    type: "mc", time: 20, double: false,
    text: "In welke Finse stad 'woont' de Kerstman volgens de Finnen?",
    options: ["Helsinki", "Turku", "Rovaniemi", "Tampere"], correct: 2,
  },
  {
    type: "tf", time: 15, double: false,
    text: "'All I Want for Christmas Is You' van Mariah Carey kwam uit in 1994.",
    correct: 0,
  },
  {
    type: "estimate", time: 20, double: false,
    text: "In welk jaar kwam de film 'Home Alone' uit?",
    correct: 1990, unit: "jaar",
  },
  {
    type: "closest", time: 30, double: false,
    text: "Kies een kerstfilm die zo dicht mogelijk bij 1995 uitkwam",
    target: 1995, unit: "jaar",
    items: [
      { label: "Home Alone", value: 1990 }, { label: "Elf", value: 2003 }, { label: "Love Actually", value: 2003 },
      { label: "The Polar Express", value: 2004 }, { label: "Die Hard", value: 1988 }, { label: "It's a Wonderful Life", value: 1946 },
      { label: "The Holiday", value: 2006 }, { label: "Jingle All the Way", value: 1996 },
      { label: "How the Grinch Stole Christmas", value: 2000 }, { label: "Klaus", value: 2019 },
    ],
  },
  {
    type: "mc", time: 20, double: false,
    text: "Hoe heet het rendier met de rode neus?",
    options: ["Comet", "Rudolf", "Blitzen", "Dancer"], correct: 1,
  },
  {
    type: "mc", time: 30, double: true,
    text: "Fotovraag: welke collega is dit als baby? (voeg zelf een foto en namen toe)",
    options: ["Collega A", "Collega B", "Collega C", "Collega D"], correct: 0,
  },
];
