<template>
  <div class="game-view">
    <div
      ref="gameZone"
      class="game-view__zone"
      tabindex="0"
      @click="handleClick"
      @mousedown="onMouseDown"
      @mouseup="onMouseUp"
      @mouseleave="onMouseLeave"
    >
      <Zone
        v-for="(zone, index) in levelData.zones"
        :key="index"
        :points="zone.points"
      />
      <Enemy
        v-for="(enemy, index) in enemies"
        :key="`enemy${enemy.position.x}${enemy.position.y}${index}`"
        :position="enemy.position"
        :selected="enemy.selected"
        :health="enemy.health"
        :max-health="enemy.maxHealth"
        :type="enemy.type"
      />
      <Tower
        v-for="tower in towers"
        :key="`tower${tower.position.x}${tower.position.y}`"
        :position="tower.position"
        :radius="tower.radius"
        :level="tower.level"
        :target="tower.target"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute } from 'vue-router';

import Enemy from '@/components/Enemy.vue';
import Tower from '@/components/Tower.vue';
import Zone from '@/components/Zone.vue';
import { LEVELS, LONG_PRESS_DURATION, MAPS } from '@/shared/constants';
import { Point, TowerModel, EnemyModel } from '@/shared/models';
import { createGameLoop } from '@/shared/utils';

const gameZone = ref(null);
const currentLevel = ref(1);
const towers = ref([]);
const enemies = ref([]);
const selectedEnemy = ref(null);
const longPressTimer = ref(null);
const cursorPoint = ref(null);

const route = useRoute();

watch(
  () => route.params.id,
  (id) => {
    const parsedId = parseInt(id);
    if (!isNaN(parsedId) && LEVELS.some((level) => level.id === parsedId)) {
      currentLevel.value = parsedId;
    } else {
      currentLevel.value = LEVELS[0].id;
    }
  },
  { immediate: true }
);

const levelData = computed(() => {
  return MAPS.find((map) => map.id === currentLevel.value);
});

const money = ref(0);
const lives = ref(10);

const spawnConfig = computed(() => {
  return (
    (levelData.value && levelData.value.spawn) || {
      interval: 1000,
      count: 10,
      speed: 80,
      health: 100,
      reward: 10,
      type: 'common',
    }
  );
});

const levelPathPercent = computed(() => {
  return (levelData.value && levelData.value.path) || [];
});

const spawnState = ref({ timer: 0, remaining: 0, index: 0 });

const getPixelPath = () => {
  if (!gameZone.value) return [];
  const rect = gameZone.value.getBoundingClientRect();
  return levelPathPercent.value.map(
    (p) => new Point((p.x / 100) * rect.width, (p.y / 100) * rect.height)
  );
};

const spawnEnemy = () => {
  const pixelPath = getPixelPath();
  if (!pixelPath.length) return;

  const cfg = spawnConfig.value;
  const start = pixelPath[0];

  let type = cfg.type;
  let speed = cfg.speed;
  let health = cfg.health;
  let reward = cfg.reward;

  if (cfg.enemies && Array.isArray(cfg.enemies) && cfg.enemies.length > 0) {
    const i = spawnState.value.index || 0;
    const e = cfg.enemies[Math.min(i, cfg.enemies.length - 1)] || {};
    type = e.type ?? type;
    speed = e.speed ?? speed;
    health = e.health ?? health;
    reward = e.reward ?? reward;
  }

  const enemy = new EnemyModel(
    new Point(start.x, start.y),
    type,
    speed,
    health,
    reward
  );
  enemy.setPath(pixelPath);
  enemies.value.push(enemy);

  if (cfg.enemies && Array.isArray(cfg.enemies) && cfg.enemies.length > 0) {
    spawnState.value.index += 1;
  }
};

watch(
  () => levelData.value,
  () => {
    spawnState.value.timer = 0;
    spawnState.value.index = 0;
    const cfg = spawnConfig.value;
    spawnState.value.remaining =
      cfg && Array.isArray(cfg.enemies) && cfg.enemies.length
        ? cfg.enemies.length
        : (cfg && cfg.count) || 0;
    enemies.value = [];
  },
  { immediate: true }
);

const onMouseDown = (event) => {
  const rect = gameZone.value.getBoundingClientRect();
  cursorPoint.value = new Point(
    event.clientX - rect.left,
    event.clientY - rect.top
  );

  longPressTimer.value = setTimeout(() => {
    deleteObject(cursorPoint.value);
    longPressTimer.value = null;
  }, LONG_PRESS_DURATION);
};

const onMouseUp = () => {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value);
    longPressTimer.value = null;
  }
};

const onMouseLeave = () => {
  onMouseUp();
};

const deleteObject = (point) => {
  const enemyIndex = enemies.value.findIndex(
    (enemy) =>
      Math.abs(enemy.position.x - point.x) < 20 &&
      Math.abs(enemy.position.y - point.y) < 20
  );

  if (enemyIndex !== -1) {
    if (selectedEnemy.value === enemyIndex) {
      selectedEnemy.value = null;
    }
    enemies.value.splice(enemyIndex, 1);
    return;
  }

  const towerIndex = towers.value.findIndex(
    (tower) =>
      Math.abs(tower.position.x - point.x) < 20 &&
      Math.abs(tower.position.y - point.y) < 20
  );

  if (towerIndex !== -1) {
    towers.value.splice(towerIndex, 1);
    return;
  }
};

const handleClick = (event) => {
  const rect = gameZone.value.getBoundingClientRect();
  const clickPoint = new Point(
    event.clientX - rect.left,
    event.clientY - rect.top
  );

  const clickPointPercent = new Point(
    (clickPoint.x / rect.width) * 100,
    (clickPoint.y / rect.height) * 100
  );

  const canBuild = levelData.value.zones.some((zone) =>
    zone.contains(clickPointPercent)
  );

  if (canBuild) {
    const isPositionTaken = [...towers.value, ...enemies.value].some(
      (obj) =>
        Math.abs(obj.position.x - clickPoint.x) < 20 &&
        Math.abs(obj.position.y - clickPoint.y) < 20
    );

    if (!isPositionTaken) {
      towers.value.push(new TowerModel(clickPoint));
    }
  }
};

const updateGame = (deltaTime) => {
  if (spawnState.value.remaining > 0) {
    spawnState.value.timer += deltaTime;
    while (
      spawnState.value.remaining > 0 &&
      spawnState.value.timer >= spawnConfig.value.interval
    ) {
      spawnState.value.timer -= spawnConfig.value.interval;
      spawnState.value.remaining -= 1;
      spawnEnemy();
    }
  }

  for (let i = enemies.value.length - 1; i >= 0; i--) {
    const enemy = enemies.value[i];
    const reachedEnd = enemy.update(deltaTime);
    if (reachedEnd) {
      enemies.value.splice(i, 1);
      if (selectedEnemy.value === i) {
        selectedEnemy.value = null;
      }
      lives.value = Math.max(0, lives.value - 1);
    }
  }

  towers.value.forEach((tower) => {
    tower.update(deltaTime);
    if (!tower.canAttack()) return;

    let targetEnemy = null;
    let minDistanceSquared = Infinity;

    enemies.value.forEach((enemy) => {
      const deltaX = enemy.position.x - tower.position.x;
      const deltaY = enemy.position.y - tower.position.y;
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;

      if (
        distanceSquared <= tower.radius * tower.radius &&
        distanceSquared < minDistanceSquared
      ) {
        minDistanceSquared = distanceSquared;
        targetEnemy = enemy;
      }
    });

    if (targetEnemy) {
      const damage = tower.attack(targetEnemy);

      if (targetEnemy.takeDamage(damage)) {
        const enemyIndex = enemies.value.indexOf(targetEnemy);
        if (enemyIndex !== -1) {
          enemies.value.splice(enemyIndex, 1);

          if (selectedEnemy.value === enemyIndex) {
            selectedEnemy.value = null;
          }
        }

        money.value += targetEnemy.reward || 0;

        tower.increaseKills();
      }
    } else {
      tower.target = null;
    }
  });
};

const { start, stop } = createGameLoop(updateGame);

onMounted(() => {
  start();
});

onBeforeUnmount(() => {
  stop();
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value);
  }
});
</script>

<style lang="scss">
.game-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 78px);
  inline-size: 100%;
}

.game-view__zone {
  position: relative;
  flex-grow: 1;
  background-color: rgba(0, 0, 20, 0.4);
  overflow: hidden;

  &:focus {
    outline: none;
  }
}
</style>
