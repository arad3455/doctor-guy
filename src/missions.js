// Emergencies in every zone, ambient kids, collectibles and the interaction loop.
import * as THREE from 'three';
import { buildKid, animateRig, makeBubble, makeAlertIcon } from './characters.js';
import { WORLD, getColliders, zoneAt } from './world.js';
import { perch } from './hospital.js';
import { ZOO } from './zoo.js';
import { BEACH, makeCrab, makeFloatRing, makeJellyfish, makeBeachBall, makeSunscreen } from './beach.js';
import { sfx } from './audio.js';
import { toon, part } from './toon.js';

// Where carried kids are handed over
export const DROPS = {
  hospital: { pos: WORLD.hospitalDoor, action: 'Hand %s to the nurses', toast: '🏥 Take %s to the hospital! <small>(or drive the ambulance 🚑)</small>', step: 'Carry to the hospital drop-off.', drive: '🚑 Drive to the hospital drop-off.', walkTo: new THREE.Vector3(0, 0, -46.5) },
  tower: { pos: WORLD.lifeguardDrop, action: 'Bring %s to the first-aid station', toast: '⛑️ Take %s to the lifeguard first-aid station! <small>(or drive the ambulance 🚑)</small>', step: 'Carry to the lifeguard tower (first aid).', drive: '🚑 Drive to the lifeguard tower.', walkTo: new THREE.Vector3(WORLD.lifeguardDrop.x + 2.2, 0, WORLD.lifeguardDrop.z + 1.6) },
  mom: { action: 'Reunite %s with Mom', toast: '💛 Bring %s to Mom at the lollipop stand!', step: 'Bring Noa to Mom at the lollipop stand.', drive: '🚑 Drive to Mom at the lollipop stand.' },
};
const fill = (text, name) => text.replace('%s', name);
const KID_NAMES = ['Noam', 'Shira', 'Itamar', 'Yuval', 'Ella', 'Ori', 'Romi', 'Ben', 'Alma', 'Eyal', 'Tamar', 'Lior', 'Maya', 'Gili', 'Yoav'];
// What the stethoscope finds (funny, never scary)
const CHECKUP_RESULTS = [
  ['💓', 'Strong heart!'], ['🫁', 'Lungs: crystal clear'], ['🍕', 'Tummy says: pizza!'], ['🦁', 'Heartbeat of a lion!'],
  ['🥁', 'Thumping like a drum'], ['🎵', 'Heart has a nice rhythm'], ['💪', 'Healthy as a horse'], ['🐝', 'Busy little heart'],
  ['🍦', 'Needs ice cream, stat!'], ['😂', 'Too ticklish to check!'], ['⭐', 'Perfect health — sticker!'], ['🐸', 'Hiccups! Hold your breath'],
];
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

export const MISSIONS = [
  {
    id: 'knee', zone: 'park', name: 'Ido', title: 'Scraped Knee', look: 'redShirt',
    at: [15, 13.2], pose: 'cry', bubble: 'Owwie!', range: 2.4,
    blurb: 'Ido fell off the swing.',
    treatment: { title: 'Patch up Ido', speed: 0.9, zone: 0.22, steps: [{ icon: '🧼', label: 'Clean the scrape' }, { icon: '🩹', label: 'Stick on a bandage' }] },
    deliver: null, reward: 3, bonusTime: 45,
  },
  {
    id: 'tower', zone: 'park', name: 'Maya', title: 'Scared at the Top', look: 'pinkHat',
    at: [WORLD.tower.x + 0.4, WORLD.tower.z + 0.4], y: WORLD.tower.top + 0.1, pose: 'cry', bubble: 'Too high!', range: 3.2,
    blurb: 'Maya is stuck on the slide tower. Stand below and catch her!',
    treatment: { title: 'Catch Maya!', speed: 1.5, zone: 0.14, steps: [{ icon: '🫶', label: '"Jump, I got you!"' }, { icon: '🙌', label: 'Catch!' }] },
    deliver: null, reward: 4, bonusTime: 50, special: 'catch',
  },
  {
    id: 'pond', zone: 'park', name: 'Yoni', title: 'Splash! Kid in the Pond', look: 'capKid',
    at: [WORLD.pond.x - 1.5, WORLD.pond.z + 1], y: -0.55, pose: 'flail', bubble: 'HELP!', range: 2.4,
    blurb: 'Yoni fell into the pond. Wade in, pull him out, then take him to the hospital.',
    treatment: { title: 'Pond rescue', speed: 1.2, zone: 0.18, steps: [{ icon: '🛟', label: 'Pull him out' }, { icon: '🩺', label: 'Check breathing' }] },
    deliver: 'hospital', reward: 6, bonusTime: 35,
  },
  {
    id: 'bee', zone: 'park', name: 'Tamar', title: 'Bee Sting', look: 'ponytail',
    at: [-30, 21], pose: 'cry', bubble: 'A bee!!', range: 2.4,
    blurb: 'Tamar got stung by the flower beds.',
    treatment: { title: 'Bee sting first aid', speed: 1.1, zone: 0.18, steps: [{ icon: '🐝', label: 'Scrape out the stinger' }, { icon: '🧊', label: 'Ice pack' }, { icon: '🍭', label: 'Bravery lollipop' }] },
    deliver: null, reward: 4, bonusTime: 45,
  },
  {
    id: 'arm', zone: 'park', name: 'Ariel', title: 'Broken Arm', look: 'glassesKid',
    at: [38, -6], pose: 'sit', bubble: 'My arm...', range: 2.4,
    blurb: 'Ariel fell out of a tree. Splint the arm, then carry him to the hospital.',
    treatment: { title: 'Splint the arm', speed: 1.25, zone: 0.16, steps: [{ icon: '🪵', label: 'Line up the splint' }, { icon: '🩹', label: 'Wrap it' }, { icon: '🎗️', label: 'Make a sling' }] },
    deliver: 'hospital', reward: 6, bonusTime: 60, cast: true,
  },
  {
    id: 'lost', zone: 'park', name: 'Noa', title: 'Lost Toddler', look: 'teddyToddler',
    at: [-45, 43], pose: 'cry', bubble: 'Mommy?', range: 2.2, hidden: true,
    blurb: 'Noa wandered off. Search the northwest woods, then bring her to her mom at the lollipop stand.',
    treatment: { title: 'Comfort Noa', speed: 0.8, zone: 0.26, steps: [{ icon: '🧸', label: 'Hug the teddy' }, { icon: '🍭', label: 'Lollipop!' }] },
    deliver: 'mom', reward: 6, bonusTime: 70,
  },

  // ---------------- Zone 2: the Beach ----------------
  {
    id: 'sunburn', zone: 'beach', name: 'Shira', title: 'Sunburn', look: 'ponytail',
    at: [18, 91], pose: 'cry', bubble: 'So hot!', range: 2.4, tint: 0xff9c8c, prop: 'sunscreen',
    blurb: 'Shira played in the sun all morning without sunscreen.',
    treatment: { title: 'Cool down Shira', speed: 1.0, zone: 0.2, steps: [{ icon: '🧴', label: 'SPF 50 sunscreen' }, { icon: '👒', label: 'Sun hat on' }, { icon: '💧', label: 'Drink some water' }] },
    deliver: null, reward: 4, bonusTime: 45,
  },
  {
    id: 'float', zone: 'beach', name: 'Lior', title: 'Drifting Away!', look: 'glassesKid',
    at: [22, 124.5], y: -0.5, pose: 'flail', bubble: 'HELP!', range: 2.8, prop: 'ring', drift: [1, 0], water: true,
    blurb: 'Lior’s float is drifting away. Wade out, tow him in, then take him to the lifeguard tower.',
    treatment: { title: 'Float rescue', speed: 1.3, zone: 0.17, steps: [{ icon: '🛟', label: 'Grab the float' }, { icon: '🏊', label: 'Tow him in' }] },
    deliver: 'tower', reward: 6, bonusTime: 40,
  },
  {
    id: 'crab', zone: 'beach', name: 'Roni', title: 'Crab Pinch', look: 'redShirt',
    at: [40, 108], pose: 'cry', bubble: 'A crab!!', range: 2.4, prop: 'crab',
    blurb: 'A crab grabbed Roni’s toe by the rocks.',
    treatment: { title: 'Free Roni’s toe', speed: 1.15, zone: 0.17, steps: [{ icon: '🦀', label: 'Gently free the toe' }, { icon: '🌊', label: 'Rinse it' }, { icon: '🩹', label: 'Bandage' }] },
    deliver: null, reward: 4, bonusTime: 45,
  },
  {
    id: 'jelly', zone: 'beach', name: 'Gal', title: 'Jellyfish Sting', look: 'capKid',
    at: [-36, 120], y: -0.3, pose: 'cry', bubble: 'It stings!', range: 2.6, prop: 'jelly', water: true,
    blurb: 'Gal brushed against a jellyfish in the shallow water.',
    treatment: { title: 'Jellyfish first aid', speed: 1.1, zone: 0.18, steps: [{ icon: '🌊', label: 'Rinse with sea water' }, { icon: '🧊', label: 'Cold pack' }, { icon: '🍭', label: 'Bravery lollipop' }] },
    deliver: null, reward: 4, bonusTime: 45,
  },
  {
    id: 'sand', zone: 'beach', name: 'Eitan', title: 'Sand in the Eyes', look: 'bandageBoy',
    at: [BEACH.castles.x + 0.6, BEACH.castles.z - 2.8], pose: 'cry', bubble: 'My eyes!', range: 2.4,
    blurb: 'A sandcastle tower collapsed right into Eitan’s face.',
    treatment: { title: 'Rinse Eitan’s eyes', speed: 0.95, zone: 0.22, steps: [{ icon: '💧', label: 'Rinse the eyes' }, { icon: '👀', label: 'Blink test' }] },
    deliver: null, reward: 3, bonusTime: 40,
  },
  {
    id: 'heat', zone: 'beach', name: 'Yael', title: 'Too Much Sun', look: 'pinkHat',
    at: [46, 93], pose: 'sit', bubble: 'Dizzy…', range: 2.4, tint: 0xffb3a3,
    blurb: 'Yael feels dizzy from the heat. Cool her down, then carry her into the shade at the lifeguard tower.',
    treatment: { title: 'Heat first aid', speed: 1.2, zone: 0.17, steps: [{ icon: '💧', label: 'Small sips of water' }, { icon: '🧊', label: 'Cool, wet towel' }] },
    deliver: 'tower', reward: 6, bonusTime: 55,
  },

  // ---------- Inside the hospital (spot = where the patient stands/sits, see hospital.js) ----------
  {
    id: 'checkup', zone: 'hospital', name: 'Dana', title: 'Check-up Time', look: 'gownKid',
    spot: 'scale', pose: 'idle', bubble: 'Hi Doc!', range: 2.6,
    blurb: 'Dana is here for her check-up. Measure her in the Exam Room.',
    treatment: { title: 'Dana’s check-up', speed: 0.95, zone: 0.22, steps: [{ icon: '📏', label: 'Measure height' }, { icon: '⚖️', label: 'Read the scale' }, { icon: '📝', label: 'Write it in the chart' }] },
    deliver: null, reward: 3, bonusTime: 45,
  },
  {
    id: 'eyes', zone: 'hospital', name: 'Omer', title: 'Eye Test', look: 'glassesKid',
    spot: 'eye', pose: 'idle', bubble: 'I can’t read it…', range: 2.6,
    blurb: 'Omer squints at the board in class. Test his eyes in the Exam Room.',
    treatment: { title: 'Omer’s eye test', speed: 1.1, zone: 0.18, steps: [{ icon: '🙈', label: 'Cover the left eye' }, { icon: '🔤', label: 'Read the letters' }, { icon: '🙉', label: 'Now the right eye' }, { icon: '👓', label: 'New glasses prescription' }] },
    deliver: null, reward: 4, bonusTime: 50,
  },
  {
    id: 'blood', zone: 'hospital', name: 'Itai', title: 'Blood Test', look: 'capKid',
    spot: 'chair', pose: 'sit', bubble: 'Will it hurt?', range: 2.6,
    blurb: 'Itai needs a blood test in the Lab. Be gentle!',
    treatment: { title: 'Itai’s blood test', speed: 1.0, zone: 0.2, steps: [{ icon: '🧴', label: 'Clean the arm' }, { icon: '💉', label: 'Draw blood — hold steady', mode: 'hold' }, { icon: '🩹', label: 'Cotton and a plaster' }, { icon: '🧪', label: 'Label the tube' }] },
    deliver: null, reward: 5, bonusTime: 55,
  },
  {
    id: 'fever', zone: 'hospital', name: 'Mika', title: 'Fever Check', look: 'ponytail',
    spot: 'bed1', pose: 'sit', bubble: 'I feel hot…', range: 2.6, tint: 0xffc2b0,
    blurb: 'Mika has a fever. Check on her in the Ward.',
    treatment: { title: 'Mika’s fever', speed: 1.0, zone: 0.2, steps: [{ icon: '🌡️', label: 'Take her temperature — hold', mode: 'hold' }, { icon: '💊', label: 'Fever medicine' }, { icon: '💧', label: 'A glass of water' }] },
    deliver: null, reward: 4, bonusTime: 50,
  },
  {
    id: 'pressure', zone: 'hospital', name: 'Avi', title: 'Blood Pressure', look: 'bandageBoy',
    spot: 'bed2', pose: 'sit', bubble: 'Ready!', range: 2.6,
    blurb: 'Avi is recovering in the Ward. Check his blood pressure.',
    treatment: { title: 'Avi’s blood pressure', speed: 1.05, zone: 0.2, steps: [{ icon: '🩺', label: 'Wrap the cuff' }, { icon: '💪', label: 'Pump the cuff — tap fast!', mode: 'mash' }, { icon: '📟', label: 'Read the monitor' }] },
    deliver: null, reward: 4, bonusTime: 50,
  },
  {
    id: 'wrist', zone: 'hospital', name: 'Noga', title: 'X-ray: Sore Wrist', look: 'pinkHat',
    spot: 'xtable', pose: 'sit', bubble: 'My wrist hurts', range: 2.8, xray: true, film: 'wrist',
    blurb: 'Noga fell off her scooter. Take an X-ray of her wrist in the X-Ray room.',
    done: 'Just a sprain — no broken bones! 🩹',
    treatment: { title: 'Noga’s wrist X-ray', speed: 1.0, zone: 0.2, steps: [{ icon: '🦺', label: 'Lead apron on' }, { icon: '🎯', label: 'Line up the wrist' }, { icon: '📸', label: 'Take the X-ray — hold still', mode: 'hold' }, { icon: '🖼️', label: 'Read the scan' }] },
    deliver: null, reward: 5, bonusTime: 55,
  },
  {
    id: 'coin', zone: 'hospital', name: 'Ben', title: 'X-ray: Swallowed a Coin', look: 'redShirt',
    spot: 'xstand', pose: 'idle', bubble: 'I swallowed a coin!', range: 2.6, xray: true, film: 'coin',
    blurb: 'Ben swallowed a coin! Find it with the chest X-ray in the X-Ray room.',
    done: 'There it is! It will pass on its own 🪙',
    treatment: { title: 'Find Ben’s coin', speed: 1.05, zone: 0.2, steps: [{ icon: '🧍', label: 'Stand against the panel' }, { icon: '📸', label: 'Take the X-ray — hold still', mode: 'hold' }, { icon: '🔍', label: 'Spot the coin' }, { icon: '🍌', label: 'Banana and lots of water' }] },
    deliver: null, reward: 5, bonusTime: 55,
  },

  // ---------------- Zone 3: Wolfson City Zoo (east along Zoo Road) ----------------
  {
    id: 'monkey', zone: 'zoo', name: 'Momo', title: 'Monkey Business!', look: 'animal:monkey',
    at: [ZOO.pens.monkey.x + 13, ZOO.pens.monkey.z], pose: 'run', bubble: 'Ooh ooh! 🩺', range: 2.4,
    chase: { x: ZOO.pens.monkey.x, z: ZOO.pens.monkey.z, r: 13 }, thanks: 'Ooh ooh! 🍌',
    blurb: 'A monkey snatched your stethoscope! Chase him around Monkey Island.',
    done: 'Stethoscope back around your neck! 🩺',
    treatment: { title: 'Get your stethoscope back', speed: 1.1, zone: 0.2, steps: [{ icon: '🍌', label: 'Offer a banana' }, { icon: '🤲', label: 'Swap it for the stethoscope' }] },
    deliver: null, reward: 6, bonusTime: 60,
  },
  {
    id: 'lion', zone: 'zoo', name: 'Gil', title: 'Too Close to the Lions!', look: 'capKid',
    at: [ZOO.pens.lion.x - 12.6, ZOO.pens.lion.z + 2.5], pose: 'cry', bubble: 'It roared at me!', range: 2.4,
    blurb: 'Gil climbed the railing at the lion pen and got a scare.',
    treatment: { title: 'Calm Gil down', speed: 1.05, zone: 0.2, steps: [{ icon: '🫱', label: 'Reach out calmly' }, { icon: '🙌', label: 'Lift him off the railing' }, { icon: '🤗', label: 'Big hug' }] },
    deliver: null, reward: 4, bonusTime: 50,
  },
  {
    id: 'giraffe', zone: 'zoo', name: 'Lia', title: 'Giraffe Kiss', look: 'ponytail',
    at: [ZOO.pens.giraffe.x + 12, ZOO.pens.giraffe.z - 6.5], pose: 'cry', bubble: 'Eww, slobber!', range: 2.4,
    blurb: 'A giraffe gave Lia a big slobbery lick.',
    treatment: { title: 'Clean up Lia', speed: 0.95, zone: 0.22, steps: [{ icon: '🧻', label: 'Wipe off the slobber' }, { icon: '🧼', label: 'Wash her hands' }, { icon: '🤳', label: 'Giraffe selfie!' }] },
    deliver: null, reward: 3, bonusTime: 45,
  },
  {
    id: 'penguin', zone: 'zoo', name: 'Tom', title: 'Slipped on the Ice', look: 'redShirt',
    at: [ZOO.pens.penguin.x + 10, ZOO.pens.penguin.z + 4], pose: 'sit', bubble: 'My ankle!', range: 2.4,
    blurb: 'Tom slipped by the penguin pool. Wrap his ankle, then get him to the hospital — Zoo Road is quickest by ambulance!',
    treatment: { title: 'Tom’s ankle', speed: 1.1, zone: 0.18, steps: [{ icon: '🧊', label: 'Ice pack' }, { icon: '🦶', label: 'Wrap the ankle' }] },
    deliver: 'hospital', reward: 8, bonusTime: 90,
  },
  {
    id: 'elephant', zone: 'zoo', name: 'Adi', title: 'Elephant Shower', look: 'bandageBoy',
    at: [ZOO.pens.elephant.x - 15.5, ZOO.pens.elephant.z - 6], pose: 'cry', bubble: 'Brrr… so cold!', range: 2.4, tint: 0xbfd8ff,
    blurb: 'An elephant sprayed Adi with its trunk. He’s soaked and shivering!',
    treatment: { title: 'Warm Adi up', speed: 1.0, zone: 0.22, steps: [{ icon: '🧺', label: 'Big fluffy towel' }, { icon: '☕', label: 'Warm cocoa' }] },
    deliver: null, reward: 3, bonusTime: 45,
  },
  {
    id: 'peanuts', zone: 'zoo', name: 'Yarden', title: 'Peanut Allergy!', look: 'glassesKid',
    at: [151.5, -26.5], pose: 'cry', bubble: 'My throat feels funny…', range: 2.4, tint: 0xffc8c8,
    blurb: 'Yarden ate the elephant’s peanuts by the ice-cream kiosk — he’s allergic! Treat him and rush him to the hospital.',
    treatment: { title: 'Allergy emergency', speed: 1.15, zone: 0.18, steps: [{ icon: '💉', label: 'EpiPen — press and hold', mode: 'hold' }, { icon: '🫁', label: 'Check his breathing' }] },
    deliver: 'hospital', reward: 9, bonusTime: 90,
  },
];

const BEACON_MAT = new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0.22, depthWrite: false });
const BEACON_GREEN = new THREE.MeshBasicMaterial({ color: 0x4cc35a, transparent: true, opacity: 0.25, depthWrite: false });

function beacon(mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 40, 16, 1, true), mat);
  m.position.y = 20;
  return m;
}

export class MissionSystem {
  constructor(scene, player, ui) {
    this.scene = scene;
    this.player = player;
    this.ui = ui;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.reset();
  }

  reset() {
    this.group.clear();
    this.time = 0;
    this.lollipops = 0;
    this.nextSpawn = 2;
    this.queue = [...MISSIONS];
    this.missions = [];
    this.ambient = [];
    this.leaving = [];
    this.busy = false;
    this.finished = false;
    this.zonesSeen = new Set(['park']);

    // Mom waiting at the stand
    this.mom = buildKid('mom');
    this.mom.root.position.set(WORLD.stand.x + 2.2, 0, WORLD.stand.z + 1.5);
    this.mom.root.rotation.y = -0.6;
    this.group.add(this.mom.root);
    this.momBubble = makeBubble('Noa?! 😟', { w: 256 });
    this.momBubble.position.y = 2.6;
    this.momBubble.visible = false;
    this.mom.root.add(this.momBubble);
    getColliders().push({ type: 'circle', x: this.mom.root.position.x, z: this.mom.root.position.z, r: 0.4 });

    this.deliverBeacon = beacon(BEACON_GREEN);
    this.deliverBeacon.visible = false;
    this.group.add(this.deliverBeacon);

    this.spawnAmbient();
    this.spawnLollipops();
  }

  spawnAmbient() {
    // Kids on swings
    const seats = this.ui.swingSeats;
    [['ponytail', 0], ['bandageBoy', 2]].forEach(([look, i]) => {
      const kid = buildKid(look);
      // sit ON the seat (top at -(3.4 - 0.7) + 0.04 below the pivot), centred front-to-back
      const seatTop = -(3.4 - 0.7) + 0.04;
      // facing north, towards the fountain and the paths (turned 180°, so the front-back offset flips)
      kid.root.rotation.y = Math.PI;
      if (kid.seat) kid.root.position.set(0, seatTop - kid.seat.bottom + 0.01, kid.seat.z);
      else kid.root.position.set(0, seatTop - 0.09, 0);
      seats[i].pivot.add(kid.root);
      this.ambient.push({ kid, mode: 'swing' });
    });
    // Kids strolling the ring path
    ['gownKid', 'capKid', 'pinkHat', 'redShirt'].forEach((look, i) => {
      const kid = buildKid(look);
      this.group.add(kid.root);
      this.ambient.push({ kid, mode: 'stroll', a: i * 1.6, r: 22.5 + (i % 2), speed: (i % 2 ? -1 : 1) * (0.05 + i * 0.01) });
    });
    // Kid waving by the fountain
    const waver = buildKid('glassesKid');
    waver.root.position.set(4, 0, 2.5);
    waver.root.rotation.y = 0.8;
    this.group.add(waver.root);
    this.ambient.push({ kid: waver, mode: 'wave' });

    // ---- Beach: kids bobbing on floats, one chasing a beach ball, one by the sandcastles
    [['redShirt', 6, 121, 0xffd23f], ['ponytail', -14, 122.5, 0xff5fa2]].forEach(([look, x, z, col], i) => {
      const kid = buildKid(look);
      kid.root.position.set(x, -0.5, z);
      kid.root.rotation.y = Math.PI;
      const ring = makeFloatRing(col);
      ring.position.y = 0.55;
      kid.root.add(ring);
      this.group.add(kid.root);
      this.ambient.push({ kid, mode: 'float', x, z, phase: i * 2 });
    });
    const baller = buildKid('capKid');
    this.group.add(baller.root);
    const ball = makeBeachBall();
    this.group.add(ball);
    this.ambient.push({ kid: baller, mode: 'ball', ball });
    // ---- Zoo: visitors strolling the ring path
    ['ponytail', 'redShirt', 'pinkHat', 'capKid'].forEach((look, i) => {
      const kid = buildKid(look);
      this.group.add(kid.root);
      this.ambient.push({ kid, mode: 'stroll', a: i * 1.5, r: ZOO.ring + (i % 2 ? 0.8 : -0.8), speed: (i % 2 ? 1 : -1) * 0.045, cx: ZOO.center.x, cz: ZOO.center.z });
    });

    const builder = buildKid('gownKid');
    builder.root.position.set(BEACH.castles.x - 2.4, 0, BEACH.castles.z - 1.2);
    builder.root.rotation.y = 1.2;
    this.group.add(builder.root);
    this.ambient.push({ kid: builder, mode: 'wave' });
  }

  spawnLollipops() {
    this.pops = [];
    const colors = [0xe0323a, 0x2f7fc1, 0x4cc35a, 0xc66bd6, 0xffb000];
    let seed = 99;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let n = 0, tries = 0;
    while (n < 30 && tries < 2000) {
      tries++;
      const x = (rnd() * 2 - 1) * 50, z = (rnd() * 2 - 1) * 48;
      if (z < -36) continue;
      if (getColliders().some((c) => c.type === 'circle'
        ? Math.hypot(c.x - x, c.z - z) < c.r + 1
        : x > c.minX - 1 && x < c.maxX + 1 && z > c.minZ - 1 && z < c.maxZ + 1)) continue;
      if (Math.hypot(x - WORLD.pond.x, z - WORLD.pond.z) < WORLD.pond.r) continue;
      const g = new THREE.Group();
      const candy = part(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 20), colors[n % colors.length], { outline: 0.03 });
      candy.rotation.x = Math.PI / 2;
      candy.position.y = 0.55;
      g.add(candy);
      const swirl = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 6, 16), toon(0xffffff));
      swirl.position.set(0, 0.55, 0.045);
      g.add(swirl);
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), toon(0xffffff));
      stick.position.y = 0.2;
      g.add(stick);
      g.position.set(x, 0.4, z);
      this.group.add(g);
      this.pops.push(g);
      n++;
    }
    // a trail down the boardwalk and some on the sand
    const spots = [[0, 64], [0, 72], [-20, 88], [10, 100], [30, 96], [-40, 106], [44, 112], [-10, 112], [52, 88], [-48, 96]];
    spots.forEach(([x, z], i) => {
      const g = new THREE.Group();
      const candy = part(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 20), colors[i % colors.length], { outline: 0.03 });
      candy.rotation.x = Math.PI / 2;
      candy.position.y = 0.55;
      g.add(candy);
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), toon(0xffffff));
      stick.position.y = 0.2;
      g.add(stick);
      g.position.set(x, 0.4, z);
      this.group.add(g);
      this.pops.push(g);
    });
  }

  spawnMission(def) {
    const kid = def.look.startsWith('animal:') ? this.ui.zoo.makeMonkey() : buildKid(def.look);
    const spot = def.spot ? this.ui.hospital?.spots[def.spot] : null;
    if (spot) {
      def.at = [spot.pos.x, spot.pos.z];
      perch(kid, spot);
    } else {
      kid.root.position.set(def.at[0], def.y ?? 0, def.at[1]);
      kid.root.rotation.y = Math.atan2(this.player.pos.x - def.at[0], this.player.pos.z - def.at[1]);
    }
    const [x, z] = def.at;
    (spot ? this.ui.hospital.group : this.group).add(kid.root);
    const bubble = makeBubble(def.bubble);
    bubble.position.y = kid.height + 0.9;
    kid.root.add(bubble);
    const icon = makeAlertIcon();
    icon.position.y = kid.height + 1.9;
    kid.root.add(icon);
    const bc = beacon(BEACON_MAT);
    bc.position.set(x, 20, z);
    if (spot) bc.scale.y = 0.08; // indoors: a short beacon (no ceiling to stop it)
    bc.visible = !def.hidden;
    this.group.add(bc);
    if (def.hidden) { bubble.visible = false; icon.visible = false; }
    const m = { def, kid, bubble, icon, beacon: bc, state: 'active', spawnedAt: this.time, found: !def.hidden };
    if (def.tint) m.untint = tintKid(kid, def.tint);
    if (def.chase) { m.chaseA = 0; this.ui.toast('🐒 A monkey grabbed your stethoscope! Chase him!', 2800); }
    if (def.prop) m.prop = this.makeProp(def.prop, kid);
    this.missions.push(m);
    sfx.alert();
    const p = this.player;
    if (!this.busy && !p.carrying && Math.hypot(p.vel.x, p.vel.z) < 0.5) p.rig.playOnce?.('wave', { timeScale: 1.2, maxTime: 2.6 });
    this.ui.career?.missionStart(def, kid.root.position, this.player.pos);
    return m;
  }

  /** Mission props: a float ring around the kid, a crab at the toes, a jellyfish nearby, sunscreen. */
  makeProp(kind, kid) {
    if (kind === 'ring') {
      const ring = makeFloatRing(0x3fb6ff);
      ring.position.y = 0.55;
      kid.root.add(ring);
      return ring;
    }
    const prop = kind === 'crab' ? makeCrab() : kind === 'jelly' ? makeJellyfish() : makeSunscreen();
    const kp = kid.root.position;
    if (kind === 'crab') prop.position.set(kp.x + 0.35, 0, kp.z + 0.45);
    if (kind === 'jelly') prop.position.set(kp.x + 1.1, 0.05, kp.z + 0.8);
    if (kind === 'sunscreen') prop.position.set(kp.x - 0.7, 0, kp.z + 0.5);
    this.group.add(prop);
    return prop;
  }

  get total() { return MISSIONS.length; }
  get rescued() { return this.missions.filter((m) => m.state === 'done').length; }

  update(dt, t, input) {
    this.time += dt;
    const p = this.player.pos;

    // Entering a zone for the first time
    const zone = zoneAt(p.z, p.x);
    if (!this.zonesSeen.has(zone)) {
      this.zonesSeen.add(zone);
      this.ui.toast({
        beach: '🏖️ Zone 2 — The Beach<br><small>Kids are splashing around… keep an eye on them!</small>',
        zoo: '🦁 Zone 3 — Wolfson City Zoo<br><small>Lions, elephants, giraffes, penguins… and cheeky monkeys!</small>',
        hospital: '🏥 Wolfson Medical Center<br><small>Patients are waiting in the Exam Room, Lab and Ward</small>',
      }[zone] ?? '🌳 The Park', 3000);
      this.nextSpawn = Math.min(this.nextSpawn, this.time + (zone === 'hospital' ? 1.5 : 4));
    }

    // Spawn schedule: next emergency after a delay, sooner if the player is idle.
    // Emergencies in the zone you're in come first.
    // Indoor emergencies only appear while you're inside the hospital.
    const openList = this.missions.filter((m) => m.state !== 'done');
    const openHere = openList.filter((m) => m.def.zone === zone).length;
    if (this.queue.length && (this.time > this.nextSpawn || openHere === 0) && openHere < 3 && openList.length < 5) {
      let i = this.queue.findIndex((d) => d.zone === zone);
      if (i < 0 && zone !== 'hospital') i = this.queue.findIndex((d) => d.zone !== 'hospital');
      if (i < 0 && zone === 'hospital') i = this.queue.findIndex((d) => d.zone !== 'hospital');
      if (i >= 0) {
        this.spawnMission(this.queue.splice(i, 1)[0]);
        this.nextSpawn = this.time + 28;
      }
    }

    // Ambient kids
    for (const a of this.ambient) {
      if (a.checking) {
        // standing still for the stethoscope (swing/float kids stay put, the rest face Doctor Guy)
        if (a.mode !== 'swing' && a.mode !== 'float') {
          const kp = a.kid.root.position;
          a.kid.root.rotation.y = Math.atan2(p.x - kp.x, p.z - kp.z);
          animateRig(a.kid, 'idle', t, dt);
        } else animateRig(a.kid, a.mode === 'swing' ? 'sit' : 'idle', t, dt);
        continue;
      }
      if (a.mode === 'swing') animateRig(a.kid, 'sit', t, dt);
      else if (a.mode === 'wave') animateRig(a.kid, Math.sin(t * 0.7) > 0.3 ? 'wave' : 'idle', t, dt);
      else if (a.mode === 'stroll') {
        a.a += a.speed * dt;
        const x = (a.cx ?? 0) + Math.cos(a.a) * a.r, z = (a.cz ?? 0) + Math.sin(a.a) * a.r;
        a.kid.root.position.set(x, 0, z);
        a.kid.root.rotation.y = Math.atan2(-Math.sin(a.a) * a.speed, Math.cos(a.a) * a.speed);
        animateRig(a.kid, 'walk', t + a.r, dt);
      } else if (a.mode === 'float') {
        a.kid.root.position.set(a.x + Math.sin(t * 0.3 + a.phase) * 1.5, -0.5 + Math.sin(t * 2 + a.phase) * 0.08, a.z + Math.sin(t * 0.5 + a.phase) * 0.6);
        a.kid.root.rotation.y = Math.PI + Math.sin(t * 0.4 + a.phase) * 0.6;
        animateRig(a.kid, Math.sin(t * 0.5 + a.phase) > 0.6 ? 'wave' : 'flail', t, dt);
      } else if (a.mode === 'ball') {
        // run back and forth chasing the ball along the beach
        const u = (t * 0.08) % 2, k = u < 1 ? u : 2 - u, dir = u < 1 ? 1 : -1;
        const x = -6 + k * 22, z = 110 + Math.sin(t * 0.4) * 1.5;
        a.kid.root.position.set(x, 0, z);
        a.kid.root.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        animateRig(a.kid, 'run', t, dt, 5);
        a.ball.position.set(x + dir * 1.2, 0.32 + Math.abs(Math.sin(t * 5)) * 0.9, z);
        a.ball.rotation.z -= dir * dt * 6;
      }
    }

    // Lollipops
    for (const pop of this.pops) {
      if (!pop.visible) continue;
      pop.rotation.y += dt * 2.5;
      pop.position.y = 0.4 + Math.sin(t * 3 + pop.position.x) * 0.12;
      if (Math.hypot(pop.position.x - p.x, pop.position.z - p.z) < 1.1 && p.y < 1.5) {
        pop.visible = false;
        this.lollipops++;
        sfx.pickup();
      }
    }

    // Missions
    for (const m of this.missions) {
      const kp = m.kid.root.position;
      if (m.state === 'active') {
        animateRig(m.kid, m.kid.generated && m.def.pose === 'sit' && !m.def.spot ? 'cry' : m.def.pose, t, dt);
        m.kid.tears.visible = m.def.pose === 'cry';
        m.icon.position.y = m.kid.height + 1.9 + Math.sin(t * 4) * 0.12;
        if (m.def.id === 'pond') kp.y = -0.55 + Math.sin(t * 3) * 0.08;
        if (m.def.water && m.def.id !== 'pond') kp.y = (m.def.y ?? 0) + Math.sin(t * 2.5) * 0.06;
        if (m.def.chase) {
          // the monkey runs laps around Monkey Island — faster when you're close behind
          const c = m.def.chase;
          const near = Math.hypot(p.x - kp.x, p.z - kp.z);
          const speed = near < 7 ? 5.6 : 3.2;
          m.chaseA += (speed / c.r) * dt;
          kp.set(c.x + Math.cos(m.chaseA) * c.r, 0, c.z + Math.sin(m.chaseA) * c.r);
          m.kid.root.rotation.y = Math.atan2(-Math.sin(m.chaseA), Math.cos(m.chaseA)); // facing along the lap
          m.beacon.position.set(kp.x, 20, kp.z);
          m.def.at = [kp.x, kp.z];
        }
        if (m.def.drift && kp.x < m.def.at[0] + 16) {
          kp.x += m.def.drift[0] * dt * 0.35; // the current pulls the float along the shore
          m.beacon.position.x = kp.x;
        }
        if (m.def.prop === 'jelly' && m.prop) m.prop.position.y = 0.05 + Math.sin(t * 2) * 0.05;
        if (m.def.prop === 'crab' && m.prop) m.prop.userData.legs.forEach((l, j) => { l.rotation.z = Math.sin(t * 18 + j) * 0.3; });
        // face the player (patients on beds/chairs/scales keep still; the monkey keeps running)
        const target = Math.atan2(p.x - kp.x, p.z - kp.z);
        if (!m.def.spot && !m.def.chase) m.kid.root.rotation.y += (Math.atan2(Math.sin(target - m.kid.root.rotation.y), Math.cos(target - m.kid.root.rotation.y))) * Math.min(1, dt * 3);
        if (!m.found && Math.hypot(kp.x - p.x, kp.z - p.z) < 14) {
          m.found = true;
          m.bubble.visible = m.icon.visible = m.beacon.visible = true;
          this.ui.toast('👂 You hear crying nearby…', 1800);
        }
      } else if (m.state === 'treated' || m.state === 'lifting') {
        animateRig(m.kid, m.def.pose === 'sit' && m.def.spot ? 'sit' : 'idle', t, dt);
      } else if (m.state === 'carried') {
        animateRig(m.kid, 'carried', t, dt);
        if (m.kid.legL) {
          m.kid.legL.rotation.z = -0.55;
          m.kid.legR.rotation.z = 0.55;
        }
      } else if (m.state === 'jumping') {
        m.jumpT += dt / 0.9;
        const k = Math.min(1, m.jumpT);
        kp.lerpVectors(m.jumpFrom, m.jumpTo, k);
        kp.y += Math.sin(k * Math.PI) * 1.6;
        animateRig(m.kid, 'air', t, dt);
        if (k >= 1) this.complete(m);
      } else if (m.state === 'done' && m.def.chase) {
        // back to the island
        const c = m.def.chase;
        const to = new THREE.Vector3(c.x - kp.x, 0, c.z - kp.z);
        if (to.length() < ZOO.pens.monkey.r + 1) m.kid.root.visible = false;
        else { to.normalize(); kp.addScaledVector(to, 4 * dt); m.kid.root.rotation.y = Math.atan2(to.x, to.z); }
        animateRig(m.kid, 'run', t, dt);
      } else if (m.state === 'done') {
        const seated = m.def.spot && this.ui.hospital?.spots[m.def.spot]?.sit;
        animateRig(m.kid, seated ? 'sit' : m.celebrate > 0 ? 'cheer' : 'idle', t, dt);
        m.celebrate -= dt;
      }
    }

    // Kids walking into the hospital / into the shade after hand-off
    for (const l of this.leaving) {
      const kp = l.kid.root.position;
      const dir = l.to.clone().sub(kp).setY(0);
      if (dir.length() < 0.3) {
        if (l.vanish) l.kid.root.visible = false;
        else animateRig(l.kid, 'idle', t, dt);
        continue;
      }
      dir.normalize();
      kp.addScaledVector(dir, dt * 2.5);
      l.kid.root.rotation.y = Math.atan2(dir.x, dir.z);
      animateRig(l.kid, 'limp', t, dt);
    }

    // Mom
    const lost = this.missions.find((m) => m.def.id === 'lost');
    const momWorried = lost && lost.state !== 'done';
    this.momBubble.visible = !!momWorried;
    animateRig(this.mom, momWorried ? 'wave' : 'idle', t + 1, dt);

    // Delivery beacon
    const carried = this.missions.find((m) => m.state === 'carried');
    this.deliverBeacon.visible = !!carried;
    if (carried) {
      const target = this.dropPos(carried.def);
      this.deliverBeacon.position.set(target.x, 20, target.z);
    }

    this.ui.hospital?.setXrayInUse(this.missions.some((m) => m.def.xray && m.state !== 'done'));

    this.handleInteraction(input);

    if (!this.finished && this.rescued === this.total) {
      this.finished = true;
      setTimeout(() => this.ui.onFinished(), 2500);
    }
  }

  /** Nearest kid out playing (not an emergency) you can listen to with your stethoscope. */
  checkupAction() {
    const p = this.player.pos;
    const w = new THREE.Vector3();
    let best = null, bestD = 2.6;
    for (const a of this.ambient) {
      if (!a.kid.root.visible || a.checking) continue;
      a.kid.root.getWorldPosition(w);
      const d = Math.hypot(w.x - p.x, w.z - p.z);
      if (d < bestD && Math.abs(w.y - p.y) < 2.5) { best = a; bestD = d; }
    }
    if (!best) return null;
    best.name ??= KID_NAMES[this.ambient.indexOf(best) % KID_NAMES.length];
    const again = (best.checkedAt ?? -999) > this.time - 60;
    return { label: again ? `🩺 Check ${best.name} again` : `🩺 Check-up: ${best.name}`, run: () => this.checkup(best, again) };
  }

  /** A quick stethoscope check-up: listen, a funny result, a small reward (once a minute per kid). */
  async checkup(a, again) {
    this.busy = true;
    a.checking = true;
    const player = this.player;
    player.frozen = true;
    player.vel.set(0, 0, 0);
    const w = a.kid.root.getWorldPosition(new THREE.Vector3());
    player.facing = Math.atan2(w.x - player.pos.x, w.z - player.pos.z);
    const rig = player.rig;
    const tall = a.mode !== 'swing' && a.mode !== 'float';
    if (tall) await sleep(Math.min(0.8, rig.kneel?.() ?? 0)); // down to kid height
    const listen = makeBubble('🩺 ♥ ♥ ♥', { w: 300, bg: '#ffe3ec' });
    listen.position.y = a.kid.height + 0.9;
    a.kid.root.add(listen);
    sfx.heartbeat();
    await sleep(1.5);
    a.kid.root.remove(listen);
    const [icon, text] = CHECKUP_RESULTS[Math.floor(Math.random() * CHECKUP_RESULTS.length)];
    const result = makeBubble(`${icon} ${text}`, { w: 460, bg: '#e8fff0' });
    result.scale.multiplyScalar(1.15);
    result.position.y = a.kid.height + 0.9;
    a.kid.root.add(result);
    setTimeout(() => a.kid.root.remove(result), 3000);
    if (tall) await sleep((rig.standUp?.() ?? 0) * 0.7);
    player.frozen = false;
    this.busy = false;
    animateRig(a.kid, 'cheer', 0, 0);
    setTimeout(() => { a.checking = false; }, 1200);
    if (!again) {
      a.checkedAt = this.time;
      this.checkups = (this.checkups ?? 0) + 1;
      this.ui.career?.checkup(a.name, `${icon} ${text}`);
    } else this.ui.toast(`${a.name}: “You already checked me, Doc!” 😄`, 1800);
  }

  dropPos(def) { return def.deliver === 'mom' ? this.mom.root.position : DROPS[def.deliver].pos; }

  /** Find what E would do right now, show prompt, act on E. */
  handleInteraction(input) {
    if (this.busy) { this.ui.prompt(null); return; }
    if (this.ui.isDriving?.()) {
      // in the ambulance: hand the patient over when parked by their drop-off, otherwise "get out"
      const carried = this.missions.find((m) => m.state === 'carried');
      let a = null;
      if (carried) {
        const at = this.dropPos(carried.def), car = this.ui.vehicle();
        if (Math.hypot(car.pos.x - at.x, car.pos.z - at.z) < 9 && Math.abs(car.speed) < 3.5) {
          a = { label: `🚑 ${fill(DROPS[carried.def.deliver].action, carried.def.name)}`, run: () => { carried.byAmbulance = true; this.ui.exitVehicle(true); this.deliver(carried); } };
        }
      }
      // only show a card for the hand-over; "get out" stays on the 🚪 button / E without covering the van
      this.ui.prompt(a?.label ?? null);
      a = a ?? this.ui.vehicleAction();
      if (a && input.hit('KeyE')) a.run();
      return;
    }
    const p = this.player.pos;
    let action = null;
    const carried = this.missions.find((m) => m.state === 'carried');

    if (carried) {
      const at = this.dropPos(carried.def);
      if (Math.hypot(p.x - at.x, p.z - at.z) < 3) {
        action = { label: fill(DROPS[carried.def.deliver].action, carried.def.name), run: () => this.deliver(carried) };
      }
    } else {
      let best = null, bestD = Infinity;
      for (const m of this.missions) {
        if (m.state !== 'active' && m.state !== 'treated') continue;
        if (!m.found) continue;
        const kp = m.kid.root.position;
        const d = Math.hypot(kp.x - p.x, kp.z - p.z);
        if (d < m.def.range && d < bestD) { best = m; bestD = d; }
      }
      if (best) {
        action = best.state === 'active'
          ? { label: `Help ${best.def.name} — ${best.def.title}`, run: () => this.treat(best) }
          : { label: `Pick up ${best.def.name}`, run: () => this.pickUp(best) };
      }
    }

    if (!action) action = this.checkupAction(); // the stethoscope: any kid who isn't an emergency
    if (!action) action = this.ui.extraAction?.() ?? null; // kids come first, then doors and the ambulance
    this.ui.prompt(action ? action.label : null);
    if (action && input.hit('KeyE')) action.run();
  }

  async treat(m) {
    this.busy = true;
    this.player.frozen = true;
    this.player.vel.set(0, 0, 0);
    const kp = m.kid.root.position;
    this.player.facing = Math.atan2(kp.x - this.player.pos.x, kp.z - this.player.pos.z);
    const rig = this.player.rig;
    const kneels = m.def.special !== 'catch' && m.def.zone !== 'hospital' && !m.def.chase; // stand for catches and indoor check-ups
    if (kneels) await sleep(rig.kneel?.() ?? 0);
    const res = await this.ui.minigame.start(m.def.treatment);
    if (kneels) await sleep((rig.standUp?.() ?? 0) * 0.8);
    this.player.frozen = false;
    this.busy = false;
    if (!res) { this.ui.toast('Come back when you’re ready!', 1400); return; }
    m.misses = res.misses;
    m.kid.tears.visible = false;
    m.bubble.visible = false;
    m.icon.visible = false;
    if (m.def.cast) m.kid.cast.visible = true;

    if (m.def.special === 'catch') {
      m.state = 'jumping';
      m.jumpT = 0;
      m.jumpFrom = kp.clone();
      const fwd = new THREE.Vector3(Math.sin(this.player.facing), 0, Math.cos(this.player.facing));
      m.jumpTo = this.player.pos.clone().addScaledVector(fwd, 1.0).setY(0);
      return;
    }
    if (m.def.id === 'pond' || m.def.water) {
      // pulled out of the water next to the doctor
      kp.set(this.player.pos.x, 0, this.player.pos.z);
    }
    if (m.def.prop === 'ring' && m.prop) {
      // the empty float stays bobbing where he was
      m.kid.root.remove(m.prop);
      m.prop.position.copy(kp).setY(0.08);
      this.group.add(m.prop);
    }
    if (m.def.deliver) {
      this.pickUp(m);
      this.ui.toast(fill(DROPS[m.def.deliver].toast, m.def.name), 2400);
    } else {
      this.complete(m);
    }
  }

  async pickUp(m) {
    // bend down and lift the kid, then swing them onto the shoulders
    m.state = 'lifting';
    m.beacon.visible = false;
    this.busy = true;
    this.player.frozen = true;
    this.player.vel.set(0, 0, 0);
    const rig = this.player.rig;
    if (rig.playOnce?.('pickup', { timeScale: 2 })) {
      await sleep(Math.min(rig.timeToLowest('pickup', 2), 1.4)); // grab at the bottom of the bend…
      rig.endOnce(); // …and stand straight back up into the carry
    }
    this.player.frozen = false;
    this.busy = false;
    m.state = 'carried';
    this.player.carrying = m.kid;
    if (!this.player.rig.mountRider?.(m.kid.root, m.kid.seat)) {
      // procedural Doctor Guy: fixed spot above the shoulders
      this.player.rig.body.add(m.kid.root);
      m.kid.root.position.copy(this.player.rig.carryOffset ?? new THREE.Vector3(0, 1.62, -0.3));
      if (m.kid.seatHeight) m.kid.root.position.y += 0.52 - m.kid.seatHeight;
      m.kid.root.rotation.set(0, 0, 0);
    }
    sfx.carry();
  }

  deliver(m) {
    m.kid.root.removeFromParent();
    m.kid.root.scale.set(1, 1, 1);
    m.kid.root.quaternion.identity();
    this.group.add(m.kid.root);
    this.player.carrying = null;
    if (m.kid.legL) m.kid.legL.rotation.z = m.kid.legR.rotation.z = 0;
    const fwd = new THREE.Vector3(Math.sin(this.player.facing), 0, Math.cos(this.player.facing));
    m.kid.root.position.copy(this.player.pos).addScaledVector(fwd, 0.9).setY(0);
    if (m.def.deliver !== 'mom') {
      const d = DROPS[m.def.deliver];
      this.leaving.push({ kid: m.kid, to: d.walkTo, vanish: m.def.deliver === 'hospital' });
      if (m.def.deliver === 'hospital') {
        this.ui.hospital?.admit(m.def.look); // they'll be resting in the Ward
        this.ui.onHospitalHandover?.(); // nurses waiting outside walk them in
      }
    } else {
      m.kid.root.position.copy(this.mom.root.position).add(new THREE.Vector3(0.8, 0, 0.5));
      m.kid.root.rotation.y = this.mom.root.rotation.y;
    }
    this.complete(m);
  }

  complete(m) {
    m.state = 'done';
    if (!this.player.carrying) this.player.rig.playOnce?.('cheer', { timeScale: 1.15, maxTime: 3 });
    m.celebrate = 4;
    m.beacon.visible = false;
    m.kid.tears.visible = false;
    if ((m.def.id === 'tower' || m.def.id === 'pond' || m.def.water) && !m.def.spot) m.kid.root.position.y = 0;
    m.untint?.();
    if (m.prop && m.def.prop !== 'ring') {
      const prop = m.prop;
      if (m.def.prop === 'crab') {
        // the crab scuttles off sideways and disappears
        const t0 = this.time;
        const run = () => { prop.position.x += 0.12; if (this.time - t0 < 2.5) requestAnimationFrame(run); else this.group.remove(prop); };
        run();
      } else setTimeout(() => this.group.remove(prop), 1500);
    }
    const elapsed = this.time - m.spawnedAt;
    const lines = [{ label: m.def.zone === 'hospital' ? 'Check-up' : 'Rescue', amount: m.def.reward }];
    if (elapsed < m.def.bonusTime) lines.push({ label: '⚡ Speedy', amount: 2 });
    if (!m.misses) lines.push({ label: '🎯 Perfect treatment', amount: 1 });
    if (m.byAmbulance) lines.push({ label: '🚑 Ambulance delivery', amount: 1 });
    if (m.def.film) this.ui.hospital?.showFilm(m.def.film); // the scan lights up on the lightbox
    const thanks = makeBubble(m.def.thanks ?? 'Thanks Dr. Guy!', { w: 380, bg: '#fffbe0' });
    thanks.scale.multiplyScalar(1.3);
    thanks.position.y = m.kid.height + 0.9;
    m.kid.root.add(thanks);
    setTimeout(() => m.kid.root.remove(thanks), 3500);
    // GTA-style "PATIENT SAVED" banner; lollipops tick into the wallet as its counter runs
    const condition = m.def.done ? `${m.def.title} — ${m.def.done}` : m.def.title;
    if (this.ui.career) {
      this.ui.career.patientSaved({ name: m.def.name, condition, hospital: m.def.zone === 'hospital', lines, elapsed, perfect: !m.misses, ambulance: !!m.byAmbulance });
    } else {
      this.lollipops += lines.reduce((t, l) => t + l.amount, 0);
      sfx.success();
    }
    this.nextSpawn = Math.min(this.nextSpawn, this.time + 6);
  }
}

/** Tints a kid (sunburn / overheated). Clones materials so other kids with the same look stay normal. */
function tintKid(kid, color) {
  const restore = [];
  kid.root.traverse((o) => {
    if (!o.isMesh || o.material?.type === 'ShaderMaterial' || o.material?.type === 'SpriteMaterial') return;
    if (!o.material?.color) return;
    const original = o.material;
    o.material = original.clone();
    o.material.color.multiply(new THREE.Color(color));
    restore.push(() => { o.material = original; });
  });
  return () => restore.forEach((r) => r());
}
