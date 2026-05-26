export const JAVA_CODE = `package com.mojang.rubydung;

import java.nio.FloatBuffer;
import java.nio.IntBuffer;
import java.util.ArrayList;
import javax.swing.JOptionPane;
import org.lwjgl.BufferUtils;
import org.lwjgl.LWJGLException;
import org.lwjgl.input.Keyboard;
import org.lwjgl.input.Mouse;
import org.lwjgl.opengl.Display;
import org.lwjgl.opengl.DisplayMode;
import org.lwjgl.opengl.GL11;
import org.lwjgl.util.glu.GLU;

public class RubyDung implements Runnable {
    private static final String GAME_VERSION = "rd-132211";
    private boolean running = false;
    private Timer timer = new Timer(20.0f);
    private Level level;
    private Player player;
    private ArrayList<Chunk> chunks = new ArrayList<Chunk>();

    public void start() {
        if (running) return;
        running = true;
        new Thread(this).start();
    }

    public void run() {
        init();
        long lastTime = System.currentTimeMillis();
        int frames = 0;

        while (running && !Display.isCloseRequested()) {
            timer.advanceTime();
            for (int i = 0; i < timer.ticks; i++) {
                tick();
            }
            render(timer.a);
            Display.update();
            frames++;
            while (System.currentTimeMillis() >= lastTime + 1000) {
                System.out.println(frames + " fps, " + Chunk.updates + " chunk updates");
                Chunk.updates = 0;
                lastTime += 1000;
                frames = 0;
            }
        }
        Display.destroy();
    }

    private void init() {
        int width = 1024;
        int height = 768;
        try {
            Display.setDisplayMode(new DisplayMode(width, height));
            Display.create();
            Display.setTitle("Game");
        } catch (LWJGLException e) {
            e.printStackTrace();
            System.exit(0);
        }

        // Initialize OpenGL
        GL11.glEnable(GL11.GL_TEXTURE_2D);
        GL11.glShadeModel(GL11.GL_SMOOTH);
        GL11.glClearColor(0.5f, 0.8f, 1.0f, 0.0f);
        GL11.glEnable(GL11.GL_DEPTH_TEST);
        GL11.glEnable(GL11.GL_CULL_FACE);
        GL11.glMatrixMode(GL11.GL_PROJECTION);
        GL11.glLoadIdentity();
        GL11.glMatrixMode(GL11.GL_MODELVIEW);

        level = new Level(256, 256, 64);
        player = new Player(level);
        
        // Generate Terrain
        for(int x = 0; x < 256; x++) {
            for(int z = 0; z < 256; z++) {
                for(int y = 0; y < 64; y++) {
                    // rd-132211 flat terrain logic
                    if (y < 43) level.setBlock(x, y, z, 1); // Cobble
                    else if (y == 43) level.setBlock(x, y, z, 2); // Grass
                }
            }
        }
        
        rebuildChunks();
        Mouse.setGrabbed(true);
    }
    
    private void rebuildChunks() {
        chunks.clear();
        for(int x = 0; x < 16; x++) {
            for(int z = 0; z < 16; z++) {
                chunks.add(new Chunk(level, x * 16, z * 16, 16));
            }
        }
    }

    private void tick() {
        player.tick();
        
        // Physics and Movement (Simplified)
        if (Keyboard.isKeyDown(Keyboard.KEY_W)) player.moveRelative(0, -1, 0.1f);
        if (Keyboard.isKeyDown(Keyboard.KEY_S)) player.moveRelative(0, 1, 0.1f);
        if (Keyboard.isKeyDown(Keyboard.KEY_A)) player.moveRelative(-1, 0, 0.1f);
        if (Keyboard.isKeyDown(Keyboard.KEY_D)) player.moveRelative(1, 0, 0.1f);
        if (Keyboard.isKeyDown(Keyboard.KEY_SPACE) && player.onGround) player.jump();
        if (Keyboard.isKeyDown(Keyboard.KEY_R)) player.respawn();
        
        // Mouse looking
        if (Display.isActive()) {
            player.turn(Mouse.getDX(), Mouse.getDY());
        }
        
        // Interaction
        while (Mouse.next()) {
            if (Mouse.getEventButtonState()) {
                if (Mouse.getEventButton() == 0) player.click(0); // Break
                if (Mouse.getEventButton() == 1) player.click(1); // Place
            }
        }
    }

    private void render(float partialTicks) {
        // View setup
        float xRot = player.xRotO + (player.xRot - player.xRotO) * partialTicks;
        float yRot = player.yRotO + (player.yRot - player.yRotO) * partialTicks;
        
        GL11.glMatrixMode(GL11.GL_PROJECTION);
        GL11.glLoadIdentity();
        GLU.gluPerspective(70.0f, (float)Display.getWidth() / (float)Display.getHeight(), 0.05f, 1000.0f);
        
        GL11.glMatrixMode(GL11.GL_MODELVIEW);
        GL11.glLoadIdentity();
        GL11.glRotatef(xRot, 1.0f, 0.0f, 0.0f);
        GL11.glRotatef(yRot, 0.0f, 1.0f, 0.0f);
        GL11.glTranslatef(-player.x, -player.y - 1.62f, -player.z);
        
        GL11.glClear(GL11.GL_COLOR_BUFFER_BIT | GL11.GL_DEPTH_BUFFER_BIT);
        
        // Render Chunks
        Texture.bind();
        for(int i = 0; i < chunks.size(); i++) {
            Chunk c = chunks.get(i);
            if(c.isInFrustum(player)) {
                c.render();
            }
        }
    }

    public static void main(String[] args) {
        new RubyDung().start();
    }
}

class Chunk {
    public static int updates = 0;
    private int x0, z0, size;
    private int listId = -1;
    private boolean dirty = true;
    private Level level;

    public Chunk(Level level, int x0, int z0, int size) {
        this.level = level;
        this.x0 = x0;
        this.z0 = z0;
        this.size = size;
    }

    private void rebuild() {
        if (listId == -1) listId = GL11.glGenLists(1);
        updates++;
        GL11.glNewList(listId, GL11.GL_COMPILE);
        GL11.glBegin(GL11.GL_QUADS);
        Tesselator t = Tesselator.instance;
        
        for (int x = x0; x < x0 + size; x++) {
            for (int z = z0; z < z0 + size; z++) {
                for (int y = 0; y < 64; y++) {
                    int id = level.getBlock(x, y, z);
                    if (id > 0) {
                        Block.blocks[id].render(t, level, x, y, z);
                    }
                }
            }
        }
        GL11.glEnd();
        GL11.glEndList();
        dirty = false;
    }

    public void render() {
        if (dirty) rebuild();
        GL11.glCallList(listId);
    }
}
`;

