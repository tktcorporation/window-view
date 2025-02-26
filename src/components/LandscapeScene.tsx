import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';
import { Volume2, VolumeX } from 'lucide-react';

const LandscapeScene: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState(0);
  const [season, setSeason] = useState('spring'); // 'spring', 'summer', 'autumn', 'winter'
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const sunRef = useRef<THREE.DirectionalLight | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const treesRef = useRef<any[]>([]);
  const cloudsRef = useRef<any[]>([]);
  const starsRef = useRef<THREE.Points | null>(null);
  const sunMeshRef = useRef<THREE.Mesh | null>(null);
  const terrainRef = useRef<THREE.Mesh | null>(null);

  // Toggle sound
  const toggleSound = () => {
    setSoundEnabled(prev => !prev);
  };

  // Handle audio
  useEffect(() => {
    if (!audioRef.current) {
      // Create audio element
      const audio = new Audio();
      // Using a more reliable audio source with a compatible format
      audio.src = 'https://assets.mixkit.co/active_storage/sfx/212/212-preview.mp3';
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = 0.5;
      audioRef.current = audio;
      
      // Add error handling
      audio.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        console.error('Error code:', audio.error?.code);
        console.error('Error message:', audio.error?.message);
      });
    }

    // Play or pause based on state
    if (soundEnabled) {
      const playPromise = audioRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error("Audio play failed:", error);
          // User interaction might be required for autoplay
          if (error.name === 'NotAllowedError') {
            console.info("Audio autoplay blocked. User interaction required.");
          }
        });
      }
    } else if (audioRef.current) {
      audioRef.current.pause();
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('error', () => {});
      }
    };
  }, [soundEnabled]);

  // Sync with system clock
  useEffect(() => {
    const updateTimeFromSystemClock = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      
      // Convert to 0-1 range where 0/1 is midnight, 0.5 is noon
      const newTimeOfDay = ((hours * 3600 + minutes * 60 + seconds) % 86400) / 86400;
      setTimeOfDay(newTimeOfDay);
      
      // Determine season based on month
      const month = now.getMonth(); // 0-11
      let newSeason = 'spring';
      
      if (month >= 2 && month <= 4) {
        newSeason = 'spring'; // March-May
      } else if (month >= 5 && month <= 7) {
        newSeason = 'summer'; // June-August
      } else if (month >= 8 && month <= 10) {
        newSeason = 'autumn'; // September-November
      } else {
        newSeason = 'winter'; // December-February
      }
      
      setSeason(newSeason);
    };
    
    // Initial update
    updateTimeFromSystemClock();
    
    // Update every second
    const interval = setInterval(updateTimeFromSystemClock, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Update scene based on time of day and season
  useEffect(() => {
    if (!sceneRef.current || !sunRef.current || !rendererRef.current || !sunMeshRef.current) return;

    // Calculate sun position based on time of day
    const sunAngle = timeOfDay * Math.PI * 2;
    const sunX = Math.cos(sunAngle) * 100;
    const sunY = Math.sin(sunAngle) * 100;
    sunRef.current.position.set(sunX, Math.max(0, sunY), 10);
    
    // Update sun mesh position
    const radius = 100;
    sunMeshRef.current.position.set(sunX, Math.max(0, sunY), -50);

    // Update sky color based on time of day
    let skyColor;
    if (timeOfDay < 0.25) { // Night to sunrise
      const t = timeOfDay / 0.25;
      skyColor = new THREE.Color().lerpColors(
        new THREE.Color(0x0a1a2a), // Night blue
        new THREE.Color(0xffa07a), // Sunrise orange
        t
      );
    } else if (timeOfDay < 0.3) { // Sunrise to morning
      const t = (timeOfDay - 0.25) / 0.05;
      skyColor = new THREE.Color().lerpColors(
        new THREE.Color(0xffa07a), // Sunrise orange
        new THREE.Color(0x87ceeb), // Sky blue
        t
      );
    } else if (timeOfDay < 0.7) { // Day
      skyColor = new THREE.Color(0x87ceeb); // Sky blue
    } else if (timeOfDay < 0.75) { // Day to sunset
      const t = (timeOfDay - 0.7) / 0.05;
      skyColor = new THREE.Color().lerpColors(
        new THREE.Color(0x87ceeb), // Sky blue
        new THREE.Color(0xff7f50), // Sunset orange
        t
      );
    } else if (timeOfDay < 0.8) { // Sunset to dusk
      const t = (timeOfDay - 0.75) / 0.05;
      skyColor = new THREE.Color().lerpColors(
        new THREE.Color(0xff7f50), // Sunset orange
        new THREE.Color(0x4b0082), // Dusk purple
        t
      );
    } else { // Night
      const t = (timeOfDay - 0.8) / 0.2;
      skyColor = new THREE.Color().lerpColors(
        new THREE.Color(0x4b0082), // Dusk purple
        new THREE.Color(0x0a1a2a), // Night blue
        t
      );
    }

    // Update scene background and fog
    sceneRef.current.background = skyColor;
    if (sceneRef.current.fog instanceof THREE.FogExp2) {
      sceneRef.current.fog.color = skyColor;
    }

    // Update sun light intensity based on time of day
    let lightIntensity = 0;
    if (timeOfDay > 0.2 && timeOfDay < 0.8) {
      // Day time - full intensity
      lightIntensity = 1 - Math.abs((timeOfDay - 0.5) * 2); // Peak at noon
      lightIntensity = Math.max(0.3, lightIntensity);
    } else {
      // Night time - low intensity (moonlight)
      lightIntensity = 0.1;
    }
    sunRef.current.intensity = lightIntensity;

    // Update light color based on time of day
    let lightColor;
    if (timeOfDay < 0.25 || timeOfDay > 0.75) {
      // Night - bluish light
      lightColor = new THREE.Color(0x8888ff);
    } else if (timeOfDay < 0.3 || timeOfDay > 0.7) {
      // Sunrise/sunset - orange light
      lightColor = new THREE.Color(0xffaa66);
    } else {
      // Day - white light
      lightColor = new THREE.Color(0xffffcc);
    }
    sunRef.current.color = lightColor;

    // Update stars visibility based on time of day
    if (starsRef.current && starsRef.current.material instanceof THREE.PointsMaterial) {
      // Stars visible at night, invisible during day
      if (timeOfDay < 0.2 || timeOfDay > 0.8) {
        // Night time - stars visible
        starsRef.current.material.opacity = 0.8;
      } else if (timeOfDay < 0.25 || timeOfDay > 0.75) {
        // Dawn/dusk - stars partially visible
        starsRef.current.material.opacity = 0.3;
      } else {
        // Day time - stars invisible
        starsRef.current.material.opacity = 0;
      }
    }

    // Update trees based on season
    treesRef.current.forEach(tree => {
      if (tree.mesh && tree.mesh.children && tree.mesh.children.length > 1) {
        const foliage = tree.mesh.children[1];
        if (foliage && foliage.material) {
          switch (season) {
            case 'spring':
              // Bright green with some variation
              foliage.material.color.setRGB(
                0.2 + Math.random() * 0.1,
                0.5 + Math.random() * 0.1,
                0.2
              );
              break;
            case 'summer':
              // Deep green
              foliage.material.color.setRGB(
                0.1 + Math.random() * 0.1,
                0.4 + Math.random() * 0.1,
                0.1
              );
              break;
            case 'autumn':
              // Orange, red, yellow mix
              const autumnType = Math.random();
              if (autumnType < 0.33) {
                // Red
                foliage.material.color.setRGB(
                  0.6 + Math.random() * 0.2,
                  0.2 + Math.random() * 0.1,
                  0.1
                );
              } else if (autumnType < 0.66) {
                // Orange
                foliage.material.color.setRGB(
                  0.7 + Math.random() * 0.2,
                  0.3 + Math.random() * 0.2,
                  0.1
                );
              } else {
                // Yellow
                foliage.material.color.setRGB(
                  0.7 + Math.random() * 0.2,
                  0.7 + Math.random() * 0.2,
                  0.1
                );
              }
              break;
            case 'winter':
              // Some trees bare (smaller), some with snow (white)
              if (Math.random() > 0.5) {
                // Snow-covered
                foliage.material.color.setRGB(0.9, 0.9, 0.95);
              } else {
                // Bare trees (darker, smaller)
                foliage.material.color.setRGB(0.3, 0.3, 0.3);
                foliage.scale.set(0.7, 0.7, 0.7);
              }
              break;
          }
        }
      }
    });

    // Update terrain based on season
    if (terrainRef.current && terrainRef.current.geometry.attributes.color) {
      const colors = terrainRef.current.geometry.attributes.color.array;
      const positions = terrainRef.current.geometry.attributes.position.array;
      
      for (let i = 0; i < positions.length / 3; i++) {
        const index = i * 3;
        const height = positions[index + 1];
        
        let color = new THREE.Color();
        if (height < 0) {
          // Water - changes slightly with seasons
          switch (season) {
            case 'winter':
              color.setRGB(0.2, 0.3, 0.8); // Colder blue
              break;
            case 'summer':
              color.setRGB(0.1, 0.4, 0.7); // Warmer blue
              break;
            default:
              color.setRGB(0.2, 0.3, 0.7); // Standard blue
          }
        } else if (height < 1) {
          // Sand/Beach - relatively constant
          color.setRGB(0.8, 0.7, 0.5);
        } else if (height < 3) {
          // Grass/Low vegetation - changes with seasons
          switch (season) {
            case 'spring':
              color.setRGB(0.3, 0.6, 0.3); // Bright green
              break;
            case 'summer':
              color.setRGB(0.3, 0.5, 0.2); // Deep green
              break;
            case 'autumn':
              color.setRGB(0.5, 0.4, 0.2); // Brownish
              break;
            case 'winter':
              color.setRGB(0.8, 0.8, 0.8); // Snow-covered
              break;
          }
        } else if (height < 7) {
          // Forest floor - changes with seasons
          switch (season) {
            case 'spring':
              color.setRGB(0.3, 0.5, 0.2);
              break;
            case 'summer':
              color.setRGB(0.2, 0.4, 0.1);
              break;
            case 'autumn':
              color.setRGB(0.4, 0.3, 0.1);
              break;
            case 'winter':
              color.setRGB(0.7, 0.7, 0.7);
              break;
          }
        } else {
          // Mountains - snow-capped in winter, less snow in summer
          switch (season) {
            case 'winter':
              // More snow
              const snowLine = 6.0;
              if (height > snowLine) {
                color.setRGB(0.9, 0.9, 0.95); // Snow
              } else {
                // Gradient from rock to snow
                const t = (height - 5) / (snowLine - 5);
                color.setRGB(
                  0.6 + 0.3 * t,
                  0.6 + 0.3 * t,
                  0.6 + 0.35 * t
                );
              }
              break;
            case 'summer':
              // Less snow, higher snow line
              const summerSnowLine = 8.0;
              if (height > summerSnowLine) {
                color.setRGB(0.9, 0.9, 0.95); // Snow
              } else {
                color.setRGB(0.6, 0.6, 0.6); // Rock
              }
              break;
            default:
              // Medium snow
              const defaultSnowLine = 7.0;
              if (height > defaultSnowLine) {
                color.setRGB(0.9, 0.9, 0.95); // Snow
              } else {
                color.setRGB(0.6, 0.6, 0.6); // Rock
              }
          }
        }
        
        colors[index] = color.r;
        colors[index + 1] = color.g;
        colors[index + 2] = color.b;
      }
      
      terrainRef.current.geometry.attributes.color.needsUpdate = true;
    }

  }, [timeOfDay, season]);

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0xb7d1ff); // Light blue sky
    scene.fog = new THREE.FogExp2(0xb7d1ff, 0.005);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      60, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      1000
    );
    camera.position.set(0, 5, 20);
    camera.lookAt(0, 0, -30);

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current = renderer;
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xcccccc, 0.2);
    scene.add(ambientLight);

    // Sun (directional light)
    const directionalLight = new THREE.DirectionalLight(0xffffcc, 1);
    sunRef.current = directionalLight;
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    scene.add(directionalLight);

    // Add sun sphere (visual representation)
    const sunGeometry = new THREE.SphereGeometry(5, 16, 16);
    const sunMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffff80,
      transparent: true,
      opacity: 0.8
    });
    const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    sunMeshRef.current = sunMesh;
    scene.add(sunMesh);

    // Create terrain
    const createTerrain = () => {
      const geometry = new THREE.PlaneGeometry(200, 200, 100, 100);
      geometry.rotateX(-Math.PI / 2);
      
      const noise = new SimplexNoise();
      const positions = geometry.attributes.position.array;
      
      // Apply noise to vertices
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const z = positions[i + 2];
        
        // Generate height based on noise
        let height = 0;
        height += 5 * noise.noise(x * 0.01, z * 0.01);
        height += 2 * noise.noise(x * 0.02, z * 0.02);
        height += 0.5 * noise.noise(x * 0.04, z * 0.04);
        
        // Higher mountains in the distance
        const distanceFromCenter = Math.sqrt(x * x + z * z);
        if (z < -10) {
          height += 10 * Math.pow((z + 100) / 100, 2);
        }
        
        positions[i + 1] = height;
      }
      
      geometry.computeVertexNormals();
      
      // Create material with gradient based on height
      const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.8,
      });
      
      // Add vertex colors based on height
      const colors = [];
      for (let i = 0; i < positions.length; i += 3) {
        const height = positions[i + 1];
        
        let color = new THREE.Color();
        if (height < 0) {
          color.setRGB(0.2, 0.3, 0.7); // Water
        } else if (height < 1) {
          color.setRGB(0.8, 0.7, 0.5); // Sand
        } else if (height < 3) {
          color.setRGB(0.4, 0.6, 0.3); // Grass
        } else if (height < 7) {
          color.setRGB(0.3, 0.5, 0.2); // Forest
        } else {
          color.setRGB(0.6, 0.6, 0.6); // Mountain
        }
        
        colors.push(color.r, color.g, color.b);
      }
      
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      
      const terrain = new THREE.Mesh(geometry, material);
      terrain.receiveShadow = true;
      terrain.castShadow = true;
      terrainRef.current = terrain;
      scene.add(terrain);
      
      return terrain;
    };

    // Create trees
    const createTree = (x: number, z: number, scale: number = 1) => {
      const treeGroup = new THREE.Group();
      
      // Tree trunk
      const trunkGeometry = new THREE.CylinderGeometry(0.2 * scale, 0.3 * scale, 1 * scale, 5);
      const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      trunk.position.y = 0.5 * scale;
      trunk.castShadow = true;
      treeGroup.add(trunk);
      
      // Tree foliage (low-poly cone)
      const foliageGeometry = new THREE.ConeGeometry(1 * scale, 2 * scale, 6);
      const foliageMaterial = new THREE.MeshStandardMaterial({ 
        color: new THREE.Color(0.2 + Math.random() * 0.1, 0.4 + Math.random() * 0.1, 0.2),
        flatShading: true
      });
      const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
      foliage.position.y = 1.5 * scale + 0.5 * scale;
      foliage.castShadow = true;
      treeGroup.add(foliage);
      
      treeGroup.position.set(x, 0, z);
      scene.add(treeGroup);
      
      return treeGroup;
    };

    // Create clouds
    const createCloud = (x: number, y: number, z: number, scale: number = 1) => {
      const cloudGroup = new THREE.Group();
      
      const cloudMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
        flatShading: true
      });
      
      // Create several spheres to form a cloud
      const numSpheres = 5 + Math.floor(Math.random() * 3);
      for (let i = 0; i < numSpheres; i++) {
        const size = (0.5 + Math.random() * 0.5) * scale;
        const cloudGeometry = new THREE.SphereGeometry(size, 7, 7);
        const cloudPiece = new THREE.Mesh(cloudGeometry, cloudMaterial);
        
        // Position each sphere randomly within the cloud
        cloudPiece.position.set(
          (Math.random() - 0.5) * 2 * scale,
          (Math.random() - 0.5) * 0.5 * scale,
          (Math.random() - 0.5) * 2 * scale
        );
        
        cloudGroup.add(cloudPiece);
      }
      
      cloudGroup.position.set(x, y, z);
      scene.add(cloudGroup);
      
      return cloudGroup;
    };

    // Create stars
    const createStars = () => {
      const starsGeometry = new THREE.BufferGeometry();
      const starsMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.7,
        transparent: true,
        opacity: 0,
        sizeAttenuation: true
      });
      
      const starsVertices = [];
      for (let i = 0; i < 1000; i++) {
        const x = (Math.random() - 0.5) * 2000;
        const y = Math.random() * 1000;
        const z = (Math.random() - 0.5) * 2000;
        starsVertices.push(x, y, z);
      }
      
      starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
      const stars = new THREE.Points(starsGeometry, starsMaterial);
      starsRef.current = stars;
      scene.add(stars);
      
      return stars;
    };

    // Create scene elements
    const terrain = createTerrain();
    const stars = createStars();
    
    // Add trees
    const trees = [];
    for (let i = 0; i < 100; i++) {
      const x = (Math.random() - 0.5) * 100;
      const z = (Math.random() - 0.5) * 100;
      
      // Skip trees in the immediate foreground
      if (z > -10) continue;
      
      // Vary tree size based on distance (smaller in the distance)
      const distanceFromCamera = Math.sqrt(x * x + (z + 20) * (z + 20));
      const scale = Math.max(0.5, 2 - distanceFromCamera / 50);
      
      const tree = createTree(x, z, scale);
      trees.push({
        mesh: tree,
        initialY: tree.position.y,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 0.5
      });
    }
    treesRef.current = trees;
    
    // Add clouds
    const clouds = [];
    for (let i = 0; i < 20; i++) {
      const x = (Math.random() - 0.5) * 150;
      const y = 20 + Math.random() * 10;
      const z = -50 - Math.random() * 50;
      const scale = 2 + Math.random() * 3;
      
      const cloud = createCloud(x, y, z, scale);
      clouds.push({
        mesh: cloud,
        speed: 0.05 + Math.random() * 0.05,
        initialX: x
      });
    }
    cloudsRef.current = clouds;

    // Animation loop
    const clock = new THREE.Clock();
    
    const animate = () => {
      const time = clock.getElapsedTime();
      
      // Animate trees (gentle swaying)
      trees.forEach(tree => {
        tree.mesh.rotation.z = Math.sin(time * 0.5 + tree.phase) * 0.05;
        tree.mesh.rotation.x = Math.sin(time * 0.3 + tree.phase) * 0.03;
      });
      
      // Animate clouds (slow movement)
      clouds.forEach(cloud => {
        cloud.mesh.position.x = cloud.initialX + Math.sin(time * cloud.speed) * 10;
      });

      // Update sun position based on time of day
      const sunAngle = timeOfDay * Math.PI * 2;
      const radius = 100;
      const sunX = Math.cos(sunAngle) * radius;
      const sunY = Math.sin(sunAngle) * radius;
      if (sunMeshRef.current) {
        sunMeshRef.current.position.set(sunX, Math.max(0, sunY), -50);
      }
      
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    
    animate();

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      
      // Dispose of geometries and materials
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          if (object.geometry) object.geometry.dispose();
          
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        }
      });
      
      renderer.dispose();
    };
  }, []);

  // Get time of day name
  const getTimeOfDayName = () => {
    if (timeOfDay < 0.25) return "Night";
    if (timeOfDay < 0.3) return "Sunrise";
    if (timeOfDay < 0.7) return "Day";
    if (timeOfDay < 0.8) return "Sunset";
    return "Night";
  };

  // Format current time
  const formatTime = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" />
      
      {/* Window overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Window frame overlay */}
        <div className="absolute inset-0 border-[40px] border-[#5c4033] rounded-lg shadow-inner">
          {/* Glass effect */}
          <div className="absolute inset-0 bg-blue-100 bg-opacity-10"></div>
          
          {/* Window dividers */}
          <div className="absolute top-1/3 left-0 right-0 h-[20px] bg-[#5c4033]"></div>
          <div className="absolute top-0 bottom-0 left-1/2 w-[20px] bg-[#5c4033] -translate-x-1/2"></div>
          
          {/* Window glass reflections */}
          <div className="absolute top-0 left-0 w-1/2 h-1/3 bg-white bg-opacity-5 rounded-tl-sm"></div>
          <div className="absolute top-0 right-0 w-1/2 h-1/3 bg-white bg-opacity-5 rounded-tr-sm"></div>
          <div className="absolute top-1/3 left-0 w-1/2 h-2/3 bg-white bg-opacity-5 rounded-bl-sm"></div>
          <div className="absolute top-1/3 right-0 w-1/2 h-2/3 bg-white bg-opacity-5 rounded-br-sm"></div>
          
          {/* Window frame inner shadow */}
          <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.3)]"></div>
          
          {/* Subtle dust/dirt effect */}
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1604076913837-52ab5629fba9?q=80&w=1080&auto=format&fit=crop&ixlib=rb-4.0.3')] opacity-[0.03] mix-blend-overlay bg-repeat"></div>
          
          {/* Window sill */}
          <div className="absolute bottom-[-40px] left-[-40px] right-[-40px] h-[30px] bg-[#6d4c41] shadow-md"></div>
        </div>
      </div>

      {/* Sound control button */}
      <button 
        onClick={toggleSound}
        className="absolute bottom-6 right-6 bg-white bg-opacity-70 hover:bg-opacity-90 p-3 rounded-full shadow-lg z-10 transition-all duration-300 pointer-events-auto"
        aria-label={soundEnabled ? "Mute sound" : "Enable sound"}
      >
        {soundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
      </button>

      {/* Time and season indicator */}
      <div className="absolute top-6 left-6 bg-white bg-opacity-70 px-4 py-2 rounded-lg shadow-lg z-10">
        <div className="font-medium">{formatTime()} - {getTimeOfDayName()}</div>
        <div className="text-sm capitalize">{season}</div>
      </div>
    </div>
  );
};

export default LandscapeScene;