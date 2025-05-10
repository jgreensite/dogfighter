// app/game/client.ts
import * as THREE from 'three';
import type { Socket } from 'socket.io-client';

interface PlayerState {
  id: string;
  x: number;
  y: number;
  z: number; // For 2.5D, z might be fixed or used for visual depth
  rotation: number; // Rotation on the 2D plane (around Z axis)
  // Add other properties like health, score, etc.
}

export class GameClient {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private socket: Socket;
  private animationFrameId?: number;
  private players: Map<string, THREE.Mesh> = new Map(); // Store player meshes
  private projectiles: Map<string, THREE.Mesh> = new Map();
  private ownPlayerId: string | null = null;
  private sessionId: string;

  private keysPressed: { [key: string]: boolean } = {};

  constructor(private canvas: HTMLCanvasElement, socket: Socket, sessionId: string) {
    this.socket = socket;
    this.sessionId = sessionId;
    this.ownPlayerId = this.socket.id; // Assuming socket.id is stable after connection

    this.scene = new THREE.Scene();
    
    // For 2.5D top-down, an orthographic camera is often suitable
    // Or a perspective camera positioned directly above
    const aspect = window.innerWidth / window.innerHeight; // Adjust as needed
    const frustumSize = 20;
    // this.camera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 1, 1000);
    this.camera = new THREE.PerspectiveCamera(75, this.canvas.width / this.canvas.height, 0.1, 1000);
    this.camera.position.set(0, 0, 15); // Position camera above the scene
    this.camera.lookAt(0,0,0);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(800, 600); // Default size, can be made responsive
    this.renderer.setClearColor(0x101020); // Dark space background

    this.setupLights();
    this.setupInputListeners();
  }

  private setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    this.scene.add(directionalLight);
  }

  private setupInputListeners() {
    window.addEventListener('keydown', (event) => {
      this.keysPressed[event.key.toLowerCase()] = true;
      if (event.key === ' ') { // Spacebar
        event.preventDefault();
        this.shoot();
      }
    });
    window.addEventListener('keyup', (event) => {
      this.keysPressed[event.key.toLowerCase()] = false;
    });
  }

  private handleMovement() {
    if (!this.ownPlayerId) return;

    const playerMesh = this.players.get(this.ownPlayerId);
    if (!playerMesh) return;

    const moveSpeed = 0.1;
    const rotationSpeed = 0.05;
    let moved = false;
    let rotated = false;

    const newState = {
      x: playerMesh.position.x,
      y: playerMesh.position.y,
      rotation: playerMesh.rotation.z // Assuming Z is the up-axis for 2D plane rotation
    };

    if (this.keysPressed['w'] || this.keysPressed['arrowup']) {
      newState.x += Math.sin(newState.rotation) * moveSpeed;
      newState.y += Math.cos(newState.rotation) * moveSpeed;
      moved = true;
    }
    if (this.keysPressed['s'] || this.keysPressed['arrowdown']) {
      newState.x -= Math.sin(newState.rotation) * moveSpeed * 0.5; // Slower backward
      newState.y -= Math.cos(newState.rotation) * moveSpeed * 0.5;
      moved = true;
    }
    if (this.keysPressed['a'] || this.keysPressed['arrowleft']) {
      newState.rotation += rotationSpeed;
      rotated = true;
    }
    if (this.keysPressed['d'] || this.keysPressed['arrowright']) {
      newState.rotation -= rotationSpeed;
      rotated = true;
    }
    
    if (moved || rotated) {
      // Client-side prediction: update local mesh immediately
      playerMesh.position.x = newState.x;
      playerMesh.position.y = newState.y;
      playerMesh.rotation.z = newState.rotation;

      // Send to server
      this.socket.emit('player_input', { 
        type: 'move', 
        newState, 
        timestamp: Date.now(),
        sessionId: this.sessionId 
      });
    }
  }

  private shoot() {
     if (!this.ownPlayerId) return;
     const playerMesh = this.players.get(this.ownPlayerId);
     if (!playerMesh) return;

    console.log("Player shoots!");
    this.socket.emit('player_input', {
      type: 'shoot',
      position: { x: playerMesh.position.x, y: playerMesh.position.y },
      rotation: playerMesh.rotation.z,
      timestamp: Date.now(),
      sessionId: this.sessionId
    });
  }


  public updateGameState(state: any) {
    // This is a simplified update; a real game would need more sophisticated state management
    // including interpolation, handling new players, removing disconnected players, etc.
    
    state.players?.forEach((playerData: PlayerState) => {
      this.updatePlayerPosition(playerData.id, playerData);
    });

    // Handle projectiles (conceptual)
    // state.projectiles?.forEach(projData => this.updateProjectile(projData));
  }

  public updatePlayerPosition(playerId: string, playerData: Partial<PlayerState>) {
    let playerMesh = this.players.get(playerId);

    if (!playerMesh) {
      // Player doesn't exist, create a new one
      const geometry = new THREE.ConeGeometry(0.5, 1.5, 8); // Simple ship shape
      const material = new THREE.MeshStandardMaterial({ color: playerId === this.ownPlayerId ? 0x00ff00 : 0xff0000 });
      playerMesh = new THREE.Mesh(geometry, material);
      playerMesh.rotation.x = Math.PI / 2; // Point cone forward along its Y axis on XY plane
      this.scene.add(playerMesh);
      this.players.set(playerId, playerMesh);
      if(playerId === this.socket.id) this.ownPlayerId = playerId; // Ensure ownPlayerId is set
    }

    // Apply updates (ideally with interpolation for remote players)
    if (playerData.x !== undefined) playerMesh.position.x = playerData.x;
    if (playerData.y !== undefined) playerMesh.position.y = playerData.y;
    // For 2.5D, Z might be fixed or used for slight visual offset
    if (playerData.z !== undefined) playerMesh.position.z = playerData.z; 
    if (playerData.rotation !== undefined) playerMesh.rotation.z = playerData.rotation;
  }

  private animate = () => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    
    if(this.ownPlayerId) {
      this.handleMovement();
    }

    // Update game objects, camera, etc.
    // For example, make projectiles move
    // this.projectiles.forEach(proj => proj.translateY(0.2)); // Assuming projectiles move along their local Y

    this.renderer.render(this.scene, this.camera);
  }

  public start() {
    this.animate();
  }

  public stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    // Clean up Three.js resources, remove event listeners, etc.
    this.renderer.dispose();
    // Remove all objects from scene
    while(this.scene.children.length > 0){ 
        this.scene.remove(this.scene.children[0]); 
    }
  }
}
