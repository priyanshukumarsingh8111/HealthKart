import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const images = [
  // Doctors
  {
    url: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=600&auto=format&fit=crop&q=80',
    dest: path.join(rootDir, 'images', 'doctors', 'rahul-sharma.jpg')
  },
  {
    url: 'https://images.unsplash.com/photo-1594824813504-4e4ff81a5a4a?w=600&auto=format&fit=crop&q=80',
    dest: path.join(rootDir, 'images', 'doctors', 'priya-mehta.jpg')
  },
  {
    url: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=600&auto=format&fit=crop&q=80',
    dest: path.join(rootDir, 'images', 'doctors', 'amit-verma.jpg')
  },
  {
    url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&auto=format&fit=crop&q=80',
    dest: path.join(rootDir, 'images', 'doctors', 'neha-kapoor.jpg')
  },
  {
    url: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600&auto=format&fit=crop&q=80',
    dest: path.join(rootDir, 'images', 'doctors', 'arjun-singh.jpg')
  },
  {
    url: 'https://images.unsplash.com/photo-1651008376811-b90baee60c1f?w=600&auto=format&fit=crop&q=80',
    dest: path.join(rootDir, 'images', 'doctors', 'ananya-gupta.jpg')
  },

  // Medicines & Healthcare Products
  {
    url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80',
    dest: path.join(rootDir, 'images', 'medicines', 'paracetamol-500.jpg')
  },
  {
    url: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=600&auto=format&fit=crop&q=80',
    dest: path.join(rootDir, 'images', 'medicines', 'vitamin-d3.jpg')
  },
  {
    url: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&auto=format&fit=crop&q=80',
    dest: path.join(rootDir, 'images', 'medicines', 'bp-monitor.jpg')
  },
  {
    url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80',
    dest: path.join(rootDir, 'images', 'medicines', 'face-cleanser.jpg')
  },
  {
    url: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=600&auto=format&fit=crop&q=80',
    dest: path.join(rootDir, 'images', 'medicines', 'amoxicillin.jpg')
  },
  {
    url: 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=600&auto=format&fit=crop&q=80',
    dest: path.join(rootDir, 'images', 'medicines', 'cetirizine.jpg')
  },
  {
    url: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=600&auto=format&fit=crop&q=80',
    dest: path.join(rootDir, 'images', 'medicines', 'pulse-oximeter.jpg')
  },
  {
    url: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=600&auto=format&fit=crop&q=80',
    dest: path.join(rootDir, 'images', 'medicines', 'first-aid-kit.jpg')
  }
];

async function downloadAll() {
  for (const item of images) {
    fs.mkdirSync(path.dirname(item.dest), { recursive: true });
    try {
      console.log(`Downloading: ${path.basename(item.dest)}...`);
      const res = await fetch(item.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      fs.writeFileSync(item.dest, Buffer.from(arrayBuffer));
      console.log(`Saved: ${item.dest}`);
    } catch (err) {
      console.error(`Failed ${item.url}:`, err.message);
    }
  }
}

downloadAll();
