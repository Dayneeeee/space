const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');

        // Audio Context for sound effects
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Background music oscillators
        let menuMusicOscillators = [];
        let menuMusicGain = null;
        let menuMusicPlaying = false;

        function playSound(freq, duration, type = 'sine') {
            try {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.frequency.value = freq;
                osc.type = type;
                gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
                osc.start(audioCtx.currentTime);
                osc.stop(audioCtx.currentTime + duration);
            } catch(e) {
                // Silently fail if audio context is not available
            }
        }

        function startMenuMusic() {
            if (menuMusicPlaying) return;
            
            try {
                menuMusicGain = audioCtx.createGain();
                menuMusicGain.connect(audioCtx.destination);
                menuMusicGain.gain.setValueAtTime(0.03, audioCtx.currentTime);
                
                const notes = [
                    { freq: 220, duration: 0.5 },
                    { freq: 277, duration: 0.5 },
                    { freq: 330, duration: 0.5 },
                    { freq: 277, duration: 0.5 },
                    { freq: 247, duration: 0.5 },
                    { freq: 220, duration: 0.5 },
                    { freq: 196, duration: 0.5 },
                    { freq: 220, duration: 0.5 }
                ];
                
                let noteIndex = 0;
                
                function playNextNote() {
                    if (!menuMusicPlaying) return;
                    
                    const note = notes[noteIndex];
                    const osc = audioCtx.createOscillator();
                    const noteGain = audioCtx.createGain();
                    
                    osc.connect(noteGain);
                    noteGain.connect(menuMusicGain);
                    
                    osc.frequency.setValueAtTime(note.freq, audioCtx.currentTime);
                    osc.type = 'sine';
                    
                    noteGain.gain.setValueAtTime(0, audioCtx.currentTime);
                    noteGain.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.05);
                    noteGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + note.duration);
                    
                    osc.start(audioCtx.currentTime);
                    osc.stop(audioCtx.currentTime + note.duration);
                    
                    noteIndex = (noteIndex + 1) % notes.length;
                    setTimeout(playNextNote, note.duration * 1000);
                }
                
                const bassOsc = audioCtx.createOscillator();
                const bassGain = audioCtx.createGain();
                bassOsc.connect(bassGain);
                bassGain.connect(menuMusicGain);
                bassOsc.frequency.setValueAtTime(55, audioCtx.currentTime);
                bassOsc.type = 'sine';
                bassGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
                bassOsc.start(audioCtx.currentTime);
                menuMusicOscillators.push(bassOsc);
                
                menuMusicPlaying = true;
                playNextNote();
            } catch(e) {
                console.error('Menu music error:', e);
            }
        }

        function stopMenuMusic() {
            menuMusicPlaying = false;
            
            if (menuMusicGain) {
                menuMusicGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
            }
            
            menuMusicOscillators.forEach(osc => {
                try {
                    osc.stop(audioCtx.currentTime + 0.5);
                } catch(e) {}
            });
            
            setTimeout(() => {
                menuMusicOscillators = [];
                if (menuMusicGain) {
                    menuMusicGain.disconnect();
                    menuMusicGain = null;
                }
            }, 600);
        }

        // Game state
        let gameState = {
            score: 0,
            lives: 3,
            level: 1,
            running: false,
            paused: false,
            player: null,
            bullets: [],
            aliens: [],
            alienBullets: [],
            particles: [],
            shockwaves: [],
            floatingTexts: [],
            alienDirection: 1,
            alienSpeed: 1,
            lastAlienShot: 0,
            highScore: 0,
            combo: 0,
            lastHitTime: 0,
            screenShake: 0,
            boss: null,
            bossShootTimer: 0,
            laserPower: 0,
            laserCharging: false,
            laserActive: false,
            laserCooldown: 0,
            spacePressed: false,
            spaceHoldStart: 0
        };

        // Laser class
        class Laser {
            constructor(x, y) {
                this.x = x;
                this.y = y;
                this.width = 8;
                this.duration = 60;
                this.timer = 0;
            }

            draw() {
                const progress = this.timer / this.duration;
                const alpha = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
                
                // Main beam
                ctx.save();
                ctx.globalAlpha = alpha;
                
                // Outer glow
                const gradient = ctx.createLinearGradient(this.x - this.width, 0, this.x + this.width, 0);
                gradient.addColorStop(0, 'rgba(0, 212, 255, 0)');
                gradient.addColorStop(0.5, 'rgba(0, 255, 136, 0.8)');
                gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');
                
                ctx.fillStyle = gradient;
                ctx.fillRect(this.x - this.width * 2, 0, this.width * 4, this.y);
                
                // Core beam
                const coreGradient = ctx.createLinearGradient(this.x - this.width/2, 0, this.x + this.width/2, 0);
                coreGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
                coreGradient.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
                coreGradient.addColorStop(1, 'rgba(255, 255, 255, 0.3)');
                
                ctx.fillStyle = coreGradient;
                ctx.shadowBlur = 30;
                ctx.shadowColor = '#00ff88';
                ctx.fillRect(this.x - this.width/2, 0, this.width, this.y);
                
                // Particles along beam
                for (let i = 0; i < 10; i++) {
                    const py = (this.timer * 10 + i * 60) % this.y;
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.beginPath();
                    ctx.arc(this.x, py, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                ctx.restore();
            }

            update() {
                this.timer++;
            }

            isActive() {
                return this.timer < this.duration;
            }
        }

        // Player class
        class Player {
            constructor() {
                this.width = 40;
                this.height = 30;
                this.x = canvas.width / 2 - this.width / 2;
                this.y = canvas.height - 60;
                this.speed = 5;
                this.color = '#00ff88';
                this.invincible = false;
                this.invincibleTime = 0;
                this.animFrame = 0;
            }

            draw() {
                this.animFrame += 0.1;
                
                // Flashing effect when invincible
                if (this.invincible && Math.floor(Date.now() / 100) % 2 === 0) {
                    ctx.globalAlpha = 0.5;
                }

                ctx.save();
                
                // 3D effect with multiple layers
                // Shadow layer
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.beginPath();
                ctx.moveTo(this.x + this.width / 2, this.y + 3);
                ctx.lineTo(this.x + 3, this.y + this.height + 3);
                ctx.lineTo(this.x + this.width + 3, this.y + this.height + 3);
                ctx.closePath();
                ctx.fill();

                // Main body - darker layer (3D depth)
                ctx.fillStyle = '#006644';
                ctx.beginPath();
                ctx.moveTo(this.x + this.width / 2 - 2, this.y + 2);
                ctx.lineTo(this.x + 2, this.y + this.height);
                ctx.lineTo(this.x + this.width - 2, this.y + this.height);
                ctx.closePath();
                ctx.fill();

                // Main body - bright layer
                ctx.fillStyle = this.color;
                ctx.shadowBlur = 15;
                ctx.shadowColor = this.color;
                ctx.beginPath();
                ctx.moveTo(this.x + this.width / 2, this.y);
                ctx.lineTo(this.x, this.y + this.height);
                ctx.lineTo(this.x + this.width, this.y + this.height);
                ctx.closePath();
                ctx.fill();
                
                // Wings - 3D effect
                ctx.fillStyle = '#008866';
                ctx.beginPath();
                ctx.moveTo(this.x, this.y + this.height);
                ctx.lineTo(this.x - 10, this.y + this.height + 8);
                ctx.lineTo(this.x + 5, this.y + this.height + 5);
                ctx.closePath();
                ctx.fill();
                
                ctx.beginPath();
                ctx.moveTo(this.x + this.width, this.y + this.height);
                ctx.lineTo(this.x + this.width + 10, this.y + this.height + 8);
                ctx.lineTo(this.x + this.width - 5, this.y + this.height + 5);
                ctx.closePath();
                ctx.fill();
                
                // Cockpit with 3D depth
                ctx.fillStyle = '#004433';
                ctx.beginPath();
                ctx.arc(this.x + this.width / 2, this.y + 17, 6, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = '#00d4ff';
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#00d4ff';
                ctx.beginPath();
                ctx.arc(this.x + this.width / 2, this.y + 15, 5, 0, Math.PI * 2);
                ctx.fill();

                // Engine glow with animation
                const engineGlow = Math.sin(this.animFrame * 2) * 0.3 + 0.7;
                ctx.shadowBlur = 20;
                ctx.shadowColor = `rgba(255, 100, 0, ${engineGlow})`;
                ctx.fillStyle = `rgba(255, 100, 0, ${engineGlow})`;
                ctx.fillRect(this.x + 5, this.y + this.height, 10, 8);
                ctx.fillRect(this.x + this.width - 15, this.y + this.height, 10, 8);
                
                // Engine core
                ctx.fillStyle = 'rgba(255, 200, 100, 0.9)';
                ctx.fillRect(this.x + 7, this.y + this.height + 1, 6, 5);
                ctx.fillRect(this.x + this.width - 13, this.y + this.height + 1, 6, 5);

                ctx.restore();
                ctx.globalAlpha = 1;

                // Update invincibility
                if (this.invincible && Date.now() - this.invincibleTime > 2000) {
                    this.invincible = false;
                }
            }

            move(dir) {
                this.x += dir * this.speed;
                if (this.x < 0) this.x = 0;
                if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;
            }
        }

        // Bullet class
        class Bullet {
            constructor(x, y, isPlayer = true) {
                this.x = x;
                this.y = y;
                this.width = 3;
                this.height = 15;
                this.speed = isPlayer ? -8 : 4;
                this.color = isPlayer ? '#00ff88' : '#ff0066';
                this.isPlayer = isPlayer;
            }

            draw() {
                ctx.fillStyle = this.color;
                ctx.shadowBlur = 10;
                ctx.shadowColor = this.color;
                ctx.fillRect(this.x, this.y, this.width, this.height);
                ctx.shadowBlur = 0;
            }

            update() {
                this.y += this.speed;
            }
        }

        // Alien class with 3D effect
        class Alien {
            constructor(x, y, type = 0) {
                this.width = 35;
                this.height = 30;
                this.x = x;
                this.y = y;
                this.type = type;
                this.colors = ['#ff0066', '#ff6600', '#ffcc00'];
                this.darkColors = ['#990033', '#993300', '#996600'];
                this.points = [30, 20, 10];
                this.animFrame = 0;
            }

            draw() {
                this.animFrame += 0.1;
                const offset = Math.sin(this.animFrame) * 2;
                
                ctx.save();
                
                // Shadow
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.fillRect(this.x + 12, this.y + 7, 15, 15);
                ctx.fillRect(this.x + 7, this.y + 12, 25, 10);
                
                // 3D body - darker layer
                ctx.fillStyle = this.darkColors[this.type];
                ctx.fillRect(this.x + 11, this.y + 6, 15, 15);
                ctx.fillRect(this.x + 6, this.y + 11, 25, 10);
                
                // Main body with glow
                ctx.fillStyle = this.colors[this.type];
                ctx.shadowBlur = 15;
                ctx.shadowColor = this.colors[this.type];
                ctx.fillRect(this.x + 10, this.y + 5, 15, 15);
                ctx.fillRect(this.x + 5, this.y + 10, 25, 10);
                
                // Highlight for 3D effect
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.fillRect(this.x + 12, this.y + 7, 8, 8);
                
                ctx.shadowBlur = 0;
                
                // Tentacles with 3D
                ctx.fillStyle = this.darkColors[this.type];
                ctx.fillRect(this.x + 6, this.y + 21 + offset, 3, 8);
                ctx.fillRect(this.x + 16, this.y + 21 + offset, 3, 8);
                ctx.fillRect(this.x + 23, this.y + 21 + offset, 3, 8);
                
                ctx.fillStyle = this.colors[this.type];
                ctx.fillRect(this.x + 5, this.y + 20 + offset, 3, 8);
                ctx.fillRect(this.x + 15, this.y + 20 + offset, 3, 8);
                ctx.fillRect(this.x + 22, this.y + 20 + offset, 3, 8);
                
                // Eyes with 3D glow
                ctx.fillStyle = '#000';
                ctx.fillRect(this.x + 13, this.y + 11, 4, 4);
                ctx.fillRect(this.x + 20, this.y + 11, 4, 4);
                
                ctx.fillStyle = '#fff';
                ctx.shadowBlur = 5;
                ctx.shadowColor = '#fff';
                ctx.fillRect(this.x + 12, this.y + 10, 4, 4);
                ctx.fillRect(this.x + 19, this.y + 10, 4, 4);
                ctx.shadowBlur = 0;
                
                ctx.restore();
            }

            getPoints() {
                return this.points[this.type];
            }
        }

        // Boss alien (Mother Space)
        class BossAlien {
            constructor() {
                this.width = 120;
                this.height = 100;
                this.x = canvas.width / 2 - this.width / 2;
                this.y = 100;
                this.health = 50;
                this.maxHealth = 50;
                this.speed = 2;
                this.direction = 1;
                this.animFrame = 0;
                this.shootTimer = 0;
                this.phase = 1;
            }

            draw() {
                this.animFrame += 0.05;
                const pulse = Math.sin(this.animFrame * 3) * 5;
                
                ctx.save();
                
                // Boss body with intense glow
                ctx.shadowBlur = 30;
                ctx.shadowColor = '#ff0066';
                
                // Shadow layer for 3D
                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.fillRect(this.x + 22, this.y + 22, 80, 50);
                ctx.fillRect(this.x + 12, this.y + 32, 100, 30);
                
                // Dark layer for 3D depth
                ctx.fillStyle = '#990033';
                ctx.fillRect(this.x + 21, this.y + 21, 80, 50);
                ctx.fillRect(this.x + 11, this.y + 31, 100, 30);
                
                // Main body - larger and more menacing
                ctx.fillStyle = '#ff0066';
                ctx.fillRect(this.x + 20, this.y + 20, 80, 50);
                ctx.fillRect(this.x + 10, this.y + 30, 100, 30);
                
                // Highlight for 3D
                ctx.fillStyle = 'rgba(255, 100, 150, 0.5)';
                ctx.fillRect(this.x + 25, this.y + 25, 40, 20);
                
                // Boss eyes - glowing with 3D depth
                ctx.fillStyle = '#990000';
                ctx.beginPath();
                ctx.arc(this.x + 36, this.y + 41, 8 + pulse / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(this.x + 86, this.y + 41, 8 + pulse / 2, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = '#ff0000';
                ctx.beginPath();
                ctx.arc(this.x + 35, this.y + 40, 8 + pulse / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(this.x + 85, this.y + 40, 8 + pulse / 2, 0, Math.PI * 2);
                ctx.fill();
                
                // Pupils
                ctx.fillStyle = '#fff';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#fff';
                ctx.fillRect(this.x + 33, this.y + 38, 4, 6);
                ctx.fillRect(this.x + 83, this.y + 38, 4, 6);
                
                // Boss tentacles - animated with 3D
                ctx.shadowBlur = 20;
                for (let i = 0; i < 6; i++) {
                    const tentacleX = this.x + 20 + i * 16;
                    const tentacleOffset = Math.sin(this.animFrame * 2 + i) * 10;
                    
                    // Shadow
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                    ctx.fillRect(tentacleX + 2, this.y + 72 + tentacleOffset, 8, 25);
                    
                    // Dark layer
                    ctx.fillStyle = '#990033';
                    ctx.fillRect(tentacleX + 1, this.y + 71 + tentacleOffset, 8, 25);
                    
                    // Main tentacle
                    ctx.fillStyle = '#ff0066';
                    ctx.fillRect(tentacleX, this.y + 70 + tentacleOffset, 8, 25);
                }
                
                // Boss crown/horns with 3D
                ctx.fillStyle = '#cc0044';
                ctx.beginPath();
                ctx.moveTo(this.x + 31, this.y + 21);
                ctx.lineTo(this.x + 41, this.y + 1);
                ctx.lineTo(this.x + 51, this.y + 21);
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(this.x + 71, this.y + 21);
                ctx.lineTo(this.x + 81, this.y + 1);
                ctx.lineTo(this.x + 91, this.y + 21);
                ctx.fill();
                
                ctx.fillStyle = '#ff3388';
                ctx.beginPath();
                ctx.moveTo(this.x + 30, this.y + 20);
                ctx.lineTo(this.x + 40, this.y);
                ctx.lineTo(this.x + 50, this.y + 20);
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(this.x + 70, this.y + 20);
                ctx.lineTo(this.x + 80, this.y);
                ctx.lineTo(this.x + 90, this.y + 20);
                ctx.fill();
                
                ctx.restore();
                
                // Health bar
                const barWidth = 100;
                const barHeight = 10;
                const barX = this.x + this.width / 2 - barWidth / 2;
                const barY = this.y - 20;
                
                // Health bar background
                ctx.fillStyle = '#333';
                ctx.fillRect(barX, barY, barWidth, barHeight);
                
                // Health bar fill
                const healthPercent = this.health / this.maxHealth;
                const healthColor = healthPercent > 0.5 ? '#00ff88' : healthPercent > 0.25 ? '#ffcc00' : '#ff0066';
                ctx.fillStyle = healthColor;
                ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
                
                // Health bar border
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.strokeRect(barX, barY, barWidth, barHeight);
                
                // Boss name
                ctx.fillStyle = '#ff0066';
                ctx.font = 'bold 16px Courier New';
                ctx.textAlign = 'center';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#ff0066';
                ctx.fillText('MOTHER SPACE', this.x + this.width / 2, barY - 5);
                ctx.shadowBlur = 0;
                ctx.textAlign = 'left';
            }

            update() {
                this.x += this.speed * this.direction;
                
                if (this.x <= 0 || this.x + this.width >= canvas.width) {
                    this.direction *= -1;
                    this.y += 10;
                }
                
                if (this.health < this.maxHealth * 0.5 && this.phase === 1) {
                    this.phase = 2;
                    this.speed = 3;
                }
                
                if (this.health < this.maxHealth * 0.25 && this.phase === 2) {
                    this.phase = 3;
                    this.speed = 4;
                }
            }

            shoot() {
                const bullets = [];
                
                if (this.phase === 1) {
                    bullets.push(new Bullet(this.x + this.width / 2, this.y + this.height, false));
                } else if (this.phase === 2) {
                    bullets.push(new Bullet(this.x + 30, this.y + this.height, false));
                    bullets.push(new Bullet(this.x + this.width / 2, this.y + this.height, false));
                    bullets.push(new Bullet(this.x + this.width - 30, this.y + this.height, false));
                } else {
                    for (let i = 0; i < 5; i++) {
                        bullets.push(new Bullet(this.x + 20 + i * 20, this.y + this.height, false));
                    }
                }
                
                return bullets;
            }
        }

        // Particle class for explosions
        class Particle {
            constructor(x, y, color) {
                this.x = x;
                this.y = y;
                this.vx = (Math.random() - 0.5) * 8;
                this.vy = (Math.random() - 0.5) * 8;
                this.life = 1;
                this.color = color;
                this.size = Math.random() * 4 + 2;
            }

            draw() {
                ctx.fillStyle = this.color;
                ctx.globalAlpha = this.life;
                ctx.shadowBlur = 10;
                ctx.shadowColor = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 1;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;
                this.vy += 0.2;
                this.life -= 0.015;
            }
        }

        // Shockwave class for big explosions
        class Shockwave {
            constructor(x, y, color) {
                this.x = x;
                this.y = y;
                this.radius = 0;
                this.maxRadius = 60;
                this.color = color;
                this.life = 1;
            }

            draw() {
                ctx.strokeStyle = this.color;
                ctx.globalAlpha = this.life;
                ctx.lineWidth = 3;
                ctx.shadowBlur = 20;
                ctx.shadowColor = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 1;
            }

            update() {
                this.radius += 3;
                this.life -= 0.03;
            }
        }

        // Floating text class
        class FloatingText {
            constructor(x, y, text, color) {
                this.x = x;
                this.y = y;
                this.text = text;
                this.color = color;
                this.life = 1;
                this.vy = -2;
            }

            draw() {
                ctx.fillStyle = this.color;
                ctx.font = 'bold 20px Courier New';
                ctx.textAlign = 'center';
                ctx.globalAlpha = this.life;
                ctx.shadowBlur = 10;
                ctx.shadowColor = this.color;
                ctx.fillText(this.text, this.x, this.y);
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 1;
                ctx.textAlign = 'left';
            }

            update() {
                this.y += this.vy;
                this.life -= 0.02;
            }
        }

        function createAliens() {
            gameState.aliens = [];
            
            if (gameState.level === 3) {
                gameState.boss = new BossAlien();
                return;
            }
            
            const rows = 3 + gameState.level;
            const cols = 8;
            const spacing = 60;
            const offsetX = 100;
            const offsetY = 80;

            for (let row = 0; row < Math.min(rows, 5); row++) {
                for (let col = 0; col < cols; col++) {
                    const type = row < 1 ? 0 : row < 3 ? 1 : 2;
                    gameState.aliens.push(new Alien(offsetX + col * spacing, offsetY + row * 50, type));
                }
            }
        }

        function createExplosion(x, y, color, big = false) {
            const particleCount = big ? 30 : 20;
            for (let i = 0; i < particleCount; i++) {
                gameState.particles.push(new Particle(x, y, color));
            }
            if (big) {
                gameState.shockwaves.push(new Shockwave(x, y, color));
            }
        }

        function updateAliens() {
            if (gameState.boss) {
                gameState.boss.update();
                
                gameState.bossShootTimer++;
                if (gameState.bossShootTimer > 60 - gameState.boss.phase * 10) {
                    const bullets = gameState.boss.shoot();
                    gameState.alienBullets.push(...bullets);
                    playSound(150, 0.2, 'square');
                    gameState.bossShootTimer = 0;
                }
                
                if (gameState.boss.y + gameState.boss.height >= gameState.player.y) {
                    endGame();
                }
                return;
            }
            
            let changeDirection = false;
            
            gameState.aliens.forEach(alien => {
                alien.x += gameState.alienDirection * gameState.alienSpeed;
                
                if (alien.x <= 0 || alien.x + alien.width >= canvas.width) {
                    changeDirection = true;
                }
            });

            if (changeDirection) {
                gameState.alienDirection *= -1;
                gameState.aliens.forEach(alien => alien.y += 20);
            }

            if (Date.now() - gameState.lastAlienShot > 1000 - gameState.level * 50 && gameState.aliens.length > 0) {
                const shooter = gameState.aliens[Math.floor(Math.random() * gameState.aliens.length)];
                gameState.alienBullets.push(new Bullet(shooter.x + shooter.width / 2, shooter.y + shooter.height, false));
                playSound(150, 0.1, 'square');
                gameState.lastAlienShot = Date.now();
            }
        }

        function checkLaserCollisions(laser) {
            // Laser hitting boss
            if (gameState.boss) {
                if (laser.x > gameState.boss.x && laser.x < gameState.boss.x + gameState.boss.width &&
                    laser.y > gameState.boss.y) {
                    gameState.boss.health -= 0.5;
                    gameState.score += 5;
                    
                    if (Math.random() < 0.1) {
                        createExplosion(
                            gameState.boss.x + Math.random() * gameState.boss.width,
                            gameState.boss.y + Math.random() * gameState.boss.height,
                            '#ff0066',
                            false
                        );
                    }
                    
                    if (gameState.boss.health <= 0) {
                        for (let i = 0; i < 5; i++) {
                            setTimeout(() => {
                                createExplosion(
                                    gameState.boss.x + Math.random() * gameState.boss.width,
                                    gameState.boss.y + Math.random() * gameState.boss.height,
                                    ['#ff0066', '#ff3388', '#ff6600', '#ffcc00'][i % 4],
                                    true
                                );
                            }, i * 200);
                        }
                        
                        for (let i = 0; i < 5; i++) {
                            setTimeout(() => {
                                gameState.shockwaves.push(new Shockwave(
                                    gameState.boss.x + gameState.boss.width / 2,
                                    gameState.boss.y + gameState.boss.height / 2,
                                    '#ff0066'
                                ));
                            }, i * 150);
                        }
                        
                        gameState.score += 1000;
                        gameState.floatingTexts.push(new FloatingText(
                            gameState.boss.x + gameState.boss.width / 2,
                            gameState.boss.y + gameState.boss.height / 2,
                            '+1000 BOSS DEFEATED!',
                            '#ffcc00'
                        ));
                        
                        playSound(800, 0.3, 'sawtooth');
                        setTimeout(() => playSound(600, 0.3, 'sawtooth'), 100);
                        setTimeout(() => playSound(400, 0.5, 'sawtooth'), 200);
                        
                        gameState.screenShake = 25;
                        
                        setTimeout(() => {
                            gameState.running = false;
                            document.getElementById('pauseBtn').classList.add('hidden');
                            
                            if (gameState.score > gameState.highScore) {
                                gameState.highScore = gameState.score;
                                document.getElementById('highScoreDisplay').textContent = '🏆 VICTORY! NEW HIGH SCORE! 🏆';
                            } else {
                                document.getElementById('highScoreDisplay').textContent = '🎉 VICTORY! YOU DEFEATED MOTHER SPACE! 🎉';
                            }
                            
                            document.getElementById('finalScore').textContent = gameState.score;
                            document.getElementById('finalLevel').textContent = gameState.level;
                            document.getElementById('gameOver').querySelector('h1').textContent = 'VICTORY!';
                            document.getElementById('gameOver').classList.remove('hidden');
                            playSound(500, 1, 'sine');
                        }, 1500);
                        
                        gameState.boss = null;
                    }
                }
            }
            
            // Laser hitting aliens
            gameState.aliens = gameState.aliens.filter(alien => {
                if (laser.x > alien.x && laser.x < alien.x + alien.width &&
                    laser.y < alien.y + alien.height) {
                    
                    const basePoints = alien.getPoints();
                    gameState.score += basePoints * 2;
                    
                    createExplosion(alien.x + alien.width / 2, alien.y + alien.height / 2, alien.colors[alien.type], true);
                    
                    gameState.floatingTexts.push(new FloatingText(
                        alien.x + alien.width / 2,
                        alien.y,
                        `+${basePoints * 2}`,
                        '#ffcc00'
                    ));
                    
                    return false;
                }
                return true;
            });
        }

        function checkCollisions() {
            // Check laser collisions
            if (gameState.laserActive && gameState.laser) {
                checkLaserCollisions(gameState.laser);
            }
            
            if (gameState.boss) {
                gameState.bullets.forEach((bullet, bIndex) => {
                    if (bullet.x < gameState.boss.x + gameState.boss.width &&
                        bullet.x + bullet.width > gameState.boss.x &&
                        bullet.y < gameState.boss.y + gameState.boss.height &&
                        bullet.y + bullet.height > gameState.boss.y) {
                        
                        gameState.boss.health--;
                        gameState.score += 10;
                        
                        createExplosion(bullet.x, bullet.y, '#ff0066', false);
                        playSound(400, 0.1, 'square');
                        gameState.bullets.splice(bIndex, 1);
                        
                        gameState.screenShake = 2;
                        
                        if (gameState.boss.health <= 0) {
                            for (let i = 0; i < 5; i++) {
                                setTimeout(() => {
                                    createExplosion(
                                        gameState.boss.x + Math.random() * gameState.boss.width,
                                        gameState.boss.y + Math.random() * gameState.boss.height,
                                        ['#ff0066', '#ff3388', '#ff6600', '#ffcc00'][i % 4],
                                        true
                                    );
                                }, i * 200);
                            }
                            
                            for (let i = 0; i < 5; i++) {
                                setTimeout(() => {
                                    gameState.shockwaves.push(new Shockwave(
                                        gameState.boss.x + gameState.boss.width / 2,
                                        gameState.boss.y + gameState.boss.height / 2,
                                        '#ff0066'
                                    ));
                                }, i * 150);
                            }
                            
                            gameState.score += 1000;
                            gameState.floatingTexts.push(new FloatingText(
                                gameState.boss.x + gameState.boss.width / 2,
                                gameState.boss.y + gameState.boss.height / 2,
                                '+1000 BOSS DEFEATED!',
                                '#ffcc00'
                            ));
                            
                            playSound(800, 0.3, 'sawtooth');
                            setTimeout(() => playSound(600, 0.3, 'sawtooth'), 100);
                            setTimeout(() => playSound(400, 0.5, 'sawtooth'), 200);
                            
                            gameState.screenShake = 25;
                            
                            setTimeout(() => {
                                gameState.running = false;
                                document.getElementById('pauseBtn').classList.add('hidden');
                                
                                if (gameState.score > gameState.highScore) {
                                    gameState.highScore = gameState.score;
                                    document.getElementById('highScoreDisplay').textContent = '🏆 VICTORY! NEW HIGH SCORE! 🏆';
                                } else {
                                    document.getElementById('highScoreDisplay').textContent = '🎉 VICTORY! YOU DEFEATED MOTHER SPACE! 🎉';
                                }
                                
                                document.getElementById('finalScore').textContent = gameState.score;
                                document.getElementById('finalLevel').textContent = gameState.level;
                                document.getElementById('gameOver').querySelector('h1').textContent = 'VICTORY!';
                                document.getElementById('gameOver').classList.remove('hidden');
                                playSound(500, 1, 'sine');
                            }, 1500);
                            
                            gameState.boss = null;
                        }
                    }
                });
            }
            
            gameState.bullets.forEach((bullet, bIndex) => {
                gameState.aliens.forEach((alien, aIndex) => {
                    if (bullet.x < alien.x + alien.width &&
                        bullet.x + bullet.width > alien.x &&
                        bullet.y < alien.y + alien.height &&
                        bullet.y + bullet.height > alien.y) {
                        
                        const now = Date.now();
                        if (now - gameState.lastHitTime < 1000) {
                            gameState.combo++;
                        } else {
                            gameState.combo = 1;
                        }
                        gameState.lastHitTime = now;
                        
                        const basePoints = alien.getPoints();
                        const comboBonus = basePoints * (gameState.combo - 1) * 0.5;
                        const totalPoints = Math.floor(basePoints + comboBonus);
                        gameState.score += totalPoints;
                        
                        createExplosion(alien.x + alien.width / 2, alien.y + alien.height / 2, alien.colors[alien.type], true);
                        
                        gameState.floatingTexts.push(new FloatingText(
                            alien.x + alien.width / 2,
                            alien.y,
                            `+${totalPoints}`,
                            '#ffcc00'
                        ));
                        
                        playSound(300 + gameState.combo * 50, 0.2, 'sawtooth');
                        gameState.aliens.splice(aIndex, 1);
                        gameState.bullets.splice(bIndex, 1);
                        
                        gameState.screenShake = 3;
                    }
                });
            });

            gameState.alienBullets.forEach((bullet, index) => {
                if (!gameState.player.invincible &&
                    bullet.x < gameState.player.x + gameState.player.width &&
                    bullet.x + bullet.width > gameState.player.x &&
                    bullet.y < gameState.player.y + gameState.player.height &&
                    bullet.y + bullet.height > gameState.player.y) {
                    
                    gameState.lives--;
                    gameState.combo = 0;
                    
                    createExplosion(
                        gameState.player.x + gameState.player.width / 2,
                        gameState.player.y + gameState.player.height / 2,
                        '#00ff88',
                        true
                    );
                    createExplosion(
                        gameState.player.x + gameState.player.width / 2,
                        gameState.player.y + gameState.player.height / 2,
                        '#ff0066',
                        true
                    );
                    
                    for (let i = 0; i < 3; i++) {
                        setTimeout(() => {
                            gameState.shockwaves.push(new Shockwave(
                                gameState.player.x + gameState.player.width / 2,
                                gameState.player.y + gameState.player.height / 2,
                                i % 2 === 0 ? '#00ff88' : '#ff0066'
                            ));
                        }, i * 100);
                    }
                    
                    playSound(100, 0.5, 'sawtooth');
                    playSound(50, 0.7, 'triangle');
                    gameState.alienBullets.splice(index, 1);
                    
                    gameState.screenShake = 15;
                    
                    gameState.player.invincible = true;
                    gameState.player.invincibleTime = Date.now();
                    
                    if (gameState.lives <= 0) {
                        setTimeout(() => endGame(), 1000);
                    }
                }
            });

            gameState.aliens.forEach(alien => {
                if (alien.y + alien.height >= gameState.player.y) {
                    endGame();
                }
            });
        }

        function updatePowerMeter() {
            const powerFill = document.getElementById('powerFill');
            const powerText = document.getElementById('powerText');
            const powerMeter = document.getElementById('powerMeter');
            
            if (gameState.laserCooldown > 0) {
                powerMeter.style.display = 'block';
                powerText.style.display = 'block';
                powerText.textContent = `COOLDOWN: ${Math.ceil(gameState.laserCooldown / 60)}s`;
                powerText.style.color = '#888';
                powerFill.className = 'power-fill cooldown';
                powerFill.style.width = ((300 - gameState.laserCooldown) / 300 * 100) + '%';
                gameState.laserCooldown--;
            } else if (gameState.laserCharging) {
                powerMeter.style.display = 'block';
                powerText.style.display = 'block';
                powerText.textContent = 'CHARGING LASER...';
                powerText.style.color = '#ffcc00';
                powerFill.className = 'power-fill charging';
                powerFill.style.width = (gameState.laserPower / 300 * 100) + '%';
            } else if (gameState.laserActive) {
                powerMeter.style.display = 'block';
                powerText.style.display = 'block';
                powerText.textContent = 'MEGA LASER ACTIVE!';
                powerText.style.color = '#00ff88';
                powerFill.className = 'power-fill';
                powerFill.style.width = '100%';
            } else {
                powerMeter.style.display = 'none';
                powerText.style.display = 'none';
            }
        }

        function update() {
            if (!gameState.running || gameState.paused) return;

            let shakeX = 0;
            let shakeY = 0;
            if (gameState.screenShake > 0) {
                shakeX = (Math.random() - 0.5) * gameState.screenShake;
                shakeY = (Math.random() - 0.5) * gameState.screenShake;
                gameState.screenShake *= 0.9;
                if (gameState.screenShake < 0.5) gameState.screenShake = 0;
            }

            ctx.save();
            ctx.translate(shakeX, shakeY);
            ctx.clearRect(-shakeX, -shakeY, canvas.width, canvas.height);

            for (let i = 0; i < 100; i++) {
                const x = (i * 37) % canvas.width;
                const y = (i * 73 + Date.now() * 0.05) % canvas.height;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.fillRect(x, y, 1, 1);
            }

            gameState.shockwaves = gameState.shockwaves.filter(shockwave => {
                shockwave.update();
                shockwave.draw();
                return shockwave.life > 0 && shockwave.radius < shockwave.maxRadius;
            });

            gameState.player.draw();

            // Update laser
            if (gameState.laserActive && gameState.laser) {
                gameState.laser.update();
                gameState.laser.draw();
                
                if (!gameState.laser.isActive()) {
                    gameState.laserActive = false;
                    gameState.laser = null;
                    gameState.laserCooldown = 300;
                }
            }

            gameState.bullets = gameState.bullets.filter(bullet => {
                bullet.update();
                bullet.draw();
                return bullet.y > 0;
            });

            gameState.alienBullets = gameState.alienBullets.filter(bullet => {
                bullet.update();
                bullet.draw();
                return bullet.y < canvas.height;
            });

            updateAliens();
            if (gameState.boss) {
                gameState.boss.draw();
            } else {
                gameState.aliens.forEach(alien => alien.draw());
            }

            gameState.particles = gameState.particles.filter(particle => {
                particle.update();
                particle.draw();
                return particle.life > 0;
            });

            gameState.floatingTexts = gameState.floatingTexts.filter(text => {
                text.update();
                text.draw();
                return text.life > 0;
            });

            checkCollisions();
            updatePowerMeter();

            ctx.restore();

            document.getElementById('score').textContent = gameState.score;
            document.getElementById('lives').textContent = gameState.lives;
            document.getElementById('level').textContent = gameState.level;

            if (gameState.combo > 1) {
                ctx.fillStyle = '#ffcc00';
                ctx.font = 'bold 28px Courier New';
                ctx.textAlign = 'center';
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#ffcc00';
                ctx.fillText(`COMBO x${gameState.combo}!`, canvas.width / 2, 50);
                ctx.shadowBlur = 0;
                ctx.textAlign = 'left';
            }

            if (gameState.aliens.length === 0 && !gameState.boss) {
                if (gameState.level >= 3) {
                    return;
                }
                
                gameState.level++;
                gameState.alienSpeed += 0.5;
                createAliens();
                playSound(500, 0.5, 'sine');
                
                gameState.screenShake = 10;
                
                gameState.floatingTexts.push(new FloatingText(
                    canvas.width / 2,
                    canvas.height / 2,
                    `LEVEL ${gameState.level}!`,
                    '#00d4ff'
                ));
            }

            requestAnimationFrame(update);
        }

        const keys = {};
        
        document.addEventListener('keydown', (e) => {
            if (e.key === ' ' && gameState.running && !gameState.paused) {
                e.preventDefault();
                
                if (!gameState.spacePressed) {
                    gameState.spacePressed = true;
                    gameState.spaceHoldStart = Date.now();
                }
                
                if (gameState.laserCooldown === 0 && !gameState.laserActive) {
                    const holdTime = Date.now() - gameState.spaceHoldStart;
                    
                    if (holdTime < 5000) {
                        gameState.laserCharging = true;
                        gameState.laserPower = Math.min(300, holdTime / 5000 * 300);
                    }
                }
            }
            
            if ((e.key === 'p' || e.key === 'P') && gameState.running) {
                e.preventDefault();
                togglePause();
            }
            
            keys[e.key] = true;
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === ' ' && gameState.running && !gameState.paused) {
                e.preventDefault();
                
                const holdTime = Date.now() - gameState.spaceHoldStart;
                
                if (gameState.laserCharging && holdTime >= 5000 && gameState.laserCooldown === 0) {
                    gameState.laserActive = true;
                    gameState.laserCharging = false;
                    gameState.laser = new Laser(
                        gameState.player.x + gameState.player.width / 2,
                        gameState.player.y
                    );
                    
                    playSound(1000, 0.5, 'sawtooth');
                    playSound(800, 0.5, 'sine');
                    playSound(600, 0.5, 'triangle');
                    
                    gameState.screenShake = 8;
                    
                    gameState.floatingTexts.push(new FloatingText(
                        gameState.player.x + gameState.player.width / 2,
                        gameState.player.y - 30,
                        'MEGA LASER!',
                        '#00ff88'
                    ));
                } else if (holdTime < 5000 && gameState.bullets.filter(b => b.isPlayer).length < 3) {
                    gameState.bullets.push(new Bullet(
                        gameState.player.x + gameState.player.width / 2,
                        gameState.player.y
                    ));
                    playSound(800, 0.1, 'square');
                }
                
                gameState.spacePressed = false;
                gameState.laserCharging = false;
                gameState.laserPower = 0;
            }
            
            keys[e.key] = false;
        });

        setInterval(() => {
            if (!gameState.running || gameState.paused) return;
            if (keys['ArrowLeft']) gameState.player.move(-1);
            if (keys['ArrowRight']) gameState.player.move(1);
        }, 1000 / 60);

        function startGame() {
            stopMenuMusic();
            document.getElementById('startScreen').classList.add('hidden');
            document.getElementById('pauseBtn').classList.remove('hidden');
            gameState.score = 0;
            gameState.lives = 3;
            gameState.level = 1;
            gameState.running = true;
            gameState.paused = false;
            gameState.player = new Player();
            gameState.bullets = [];
            gameState.alienBullets = [];
            gameState.particles = [];
            gameState.shockwaves = [];
            gameState.floatingTexts = [];
            gameState.alienSpeed = 1;
            gameState.combo = 0;
            gameState.lastHitTime = 0;
            gameState.screenShake = 0;
            gameState.boss = null;
            gameState.bossShootTimer = 0;
            gameState.laserPower = 0;
            gameState.laserCharging = false;
            gameState.laserActive = false;
            gameState.laserCooldown = 0;
            gameState.laser = null;
            gameState.spacePressed = false;
            gameState.spaceHoldStart = 0;
            createAliens();
            update();
        }

        function togglePause() {
            if (!gameState.running) return;
            
            gameState.paused = !gameState.paused;
            
            if (gameState.paused) {
                document.getElementById('pauseScreen').classList.remove('hidden');
                document.getElementById('pauseScore').textContent = gameState.score;
                document.getElementById('pauseLevel').textContent = gameState.level;
                document.getElementById('pauseBtn').textContent = '▶ RESUME';
                playSound(400, 0.1, 'sine');
            } else {
                document.getElementById('pauseScreen').classList.add('hidden');
                document.getElementById('pauseBtn').textContent = '⏸ PAUSE';
                playSound(600, 0.1, 'sine');
                update();
            }
        }

        function quitToMenu() {
            gameState.running = false;
            gameState.paused = false;
            document.getElementById('pauseScreen').classList.add('hidden');
            document.getElementById('pauseBtn').classList.add('hidden');
            document.getElementById('powerMeter').style.display = 'none';
            document.getElementById('powerText').style.display = 'none';
            document.getElementById('startScreen').classList.remove('hidden');
            startMenuMusic();
        }

        function endGame() {
            gameState.running = false;
            document.getElementById('pauseBtn').classList.add('hidden');
            document.getElementById('powerMeter').style.display = 'none';
            document.getElementById('powerText').style.display = 'none';
            
            document.getElementById('gameOver').querySelector('h1').textContent = 'GAME OVER';
            
            if (gameState.score > gameState.highScore) {
                gameState.highScore = gameState.score;
                document.getElementById('highScoreDisplay').textContent = '🏆 NEW HIGH SCORE! 🏆';
            } else {
                document.getElementById('highScoreDisplay').textContent = `High Score: ${gameState.highScore}`;
            }
            
            document.getElementById('finalScore').textContent = gameState.score;
            document.getElementById('finalLevel').textContent = gameState.level;
            document.getElementById('gameOver').classList.remove('hidden');
            playSound(200, 1, 'sawtooth');
        }

        function backToMenu() {
            document.getElementById('gameOver').classList.add('hidden');
            document.getElementById('startScreen').classList.remove('hidden');
            startMenuMusic();
        }

        function restartGame() {
            document.getElementById('gameOver').classList.add('hidden');
            startGame();
        }

        function showGuidelines() {
            document.getElementById('startScreen').classList.add('hidden');
            document.getElementById('guidelinesScreen').classList.remove('hidden');
            playSound(600, 0.1, 'sine');
        }

        function hideGuidelines() {
            document.getElementById('guidelinesScreen').classList.add('hidden');
            document.getElementById('startScreen').classList.remove('hidden');
            playSound(600, 0.1, 'sine');
        }
        
        window.addEventListener('load', () => {
            document.addEventListener('click', function initAudio() {
                if (audioCtx.state === 'suspended') {
                    audioCtx.resume();
                }
                if (!menuMusicPlaying && !gameState.running) {
                    startMenuMusic();
                }
                document.removeEventListener('click', initAudio);
            }, { once: true });
        });