import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

const BASE_URL =
  __ENV.BASE_URL || "https://startling-lollipop-ae1002.netlify.app";

const ACCESS_CODE = __ENV.ACCESS_CODE || "";
const TEST_PROFILE = __ENV.TEST_PROFILE || "smoke";

const TINY_IMAGE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

const DRAWING_TYPES = [
  "colored-master-plan",
  "functional-zoning",
  "circulation-analysis",
  "grading-analysis",
  "section-drawing",
  "node-detail",
  "bird-eye-view",
  "human-perspective",
  "exploded-axonometric",
];

const accessFailRate = new Rate("access_fail_rate");
const bgStartFailRate = new Rate("bg_start_fail_rate");
const bgCheckFailRate = new Rate("bg_check_fail_rate");
const completedNineImagesRate = new Rate("completed_nine_images_rate");

const accessDuration = new Trend("access_duration");
const bgStartDuration = new Trend("bg_start_duration");
const bgCheckDuration = new Trend("bg_check_duration");
const fullIterationDuration = new Trend("full_iteration_duration");

const failedAccessCounter = new Counter("failed_access_count");
const failedStartCounter = new Counter("failed_start_count");
const failedCheckCounter = new Counter("failed_check_count");

function getOptions(profile) {
  if (profile === "smoke") {
    return {
      vus: 1,
      iterations: 1,
      thresholds: {
        http_req_failed: ["rate<0.01"],
        http_req_duration: ["p(95)<3000"],
        access_fail_rate: ["rate<0.01"],
        bg_start_fail_rate: ["rate<0.01"],
        bg_check_fail_rate: ["rate<0.01"],
        completed_nine_images_rate: ["rate>0.99"],
      },
    };
  }

  if (profile === "small") {
    return {
      stages: [
        { duration: "30s", target: 10 },
        { duration: "1m", target: 10 },
        { duration: "30s", target: 0 },
      ],
      thresholds: {
        http_req_failed: ["rate<0.02"],
        http_req_duration: ["p(95)<5000"],
        access_fail_rate: ["rate<0.02"],
        bg_start_fail_rate: ["rate<0.02"],
        bg_check_fail_rate: ["rate<0.02"],
        completed_nine_images_rate: ["rate>0.95"],
      },
    };
  }

  if (profile === "medium") {
    return {
      stages: [
        { duration: "1m", target: 50 },
        { duration: "2m", target: 50 },
        { duration: "1m", target: 100 },
        { duration: "2m", target: 100 },
        { duration: "1m", target: 0 },
      ],
      thresholds: {
        http_req_failed: ["rate<0.05"],
        http_req_duration: ["p(95)<10000"],
        access_fail_rate: ["rate<0.05"],
        bg_start_fail_rate: ["rate<0.05"],
        bg_check_fail_rate: ["rate<0.05"],
        completed_nine_images_rate: ["rate>0.90"],
      },
    };
  }

  if (profile === "large") {
    return {
      stages: [
        { duration: "1m", target: 100 },
        { duration: "2m", target: 100 },
        { duration: "1m", target: 300 },
        { duration: "2m", target: 300 },
        { duration: "1m", target: 500 },
        { duration: "2m", target: 500 },
        { duration: "1m", target: 0 },
      ],
      thresholds: {
        http_req_failed: ["rate<0.08"],
        http_req_duration: ["p(95)<15000"],
        access_fail_rate: ["rate<0.08"],
        bg_start_fail_rate: ["rate<0.08"],
        bg_check_fail_rate: ["rate<0.08"],
        completed_nine_images_rate: ["rate>0.85"],
      },
    };
  }

  if (profile === "spike1000") {
    return {
      stages: [
        { duration: "2m", target: 100 },
        { duration: "2m", target: 300 },
        { duration: "2m", target: 500 },
        { duration: "2m", target: 1000 },
        { duration: "3m", target: 1000 },
        { duration: "2m", target: 0 },
      ],
      thresholds: {
        http_req_failed: ["rate<0.12"],
        http_req_duration: ["p(95)<20000"],
        access_fail_rate: ["rate<0.12"],
        bg_start_fail_rate: ["rate<0.12"],
        bg_check_fail_rate: ["rate<0.12"],
        completed_nine_images_rate: ["rate>0.75"],
      },
    };
  }

  return {
    vus: 1,
    iterations: 1,
  };
}

export const options = getOptions(TEST_PROFILE);

function safeBody(res) {
  if (!res || !res.body) return "";
  return String(res.body).slice(0, 800);
}

function logFailure(step, res, extra = {}) {
  console.error(
    JSON.stringify({
      step,
      status: res ? res.status : "no_response",
      body: safeBody(res),
      ...extra,
    })
  );
}

export function setup() {
  if (!ACCESS_CODE) {
    throw new Error("请通过环境变量 ACCESS_CODE 传入 Demo 访问码。");
  }

  const startHealth = http.get(`${BASE_URL}/api/bg-start`, {
    timeout: "30s",
    tags: {
      name: "health_bg_start",
    },
  });

  check(startHealth, {
    "health bg-start is 200": (r) => r.status === 200,
  });

  const checkHealth = http.get(`${BASE_URL}/api/bg-check`, {
    timeout: "30s",
    tags: {
      name: "health_bg_check",
    },
  });

  check(checkHealth, {
    "health bg-check is 200": (r) => r.status === 200,
  });

  if (startHealth.status !== 200 || checkHealth.status !== 200) {
    console.error(
      JSON.stringify({
        step: "setup-health-check-failed",
        bgStartStatus: startHealth.status,
        bgStartBody: safeBody(startHealth),
        bgCheckStatus: checkHealth.status,
        bgCheckBody: safeBody(checkHealth),
      })
    );
  }

  return {
    baseUrl: BASE_URL,
  };
}

function checkAccessCode() {
  const res = http.post(
    `${BASE_URL}/api/check-access`,
    JSON.stringify({
      accessCode: ACCESS_CODE,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "landscape-plan-ai-k6-load-test",
      },
      tags: {
        name: "check_access",
      },
      timeout: "30s",
    }
  );

  accessDuration.add(res.timings.duration);

  const ok = check(res, {
    "check-access status is 200": (r) => r.status === 200,
  });

  accessFailRate.add(!ok);

  if (!ok) {
    failedAccessCounter.add(1);
    logFailure("check-access-failed", res);
    return false;
  }

  return true;
}

function startGeneration(typeId) {
  const res = http.post(
    `${BASE_URL}/api/bg-start`,
    JSON.stringify({
      imageDataUrl: TINY_IMAGE_DATA_URL,
      typeId,
      accessCode: ACCESS_CODE,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "landscape-plan-ai-k6-load-test",
      },
      tags: {
        name: "bg_start",
        typeId,
      },
      timeout: "30s",
    }
  );

  bgStartDuration.add(res.timings.duration);

  const ok = check(res, {
    "bg-start status is 200": (r) => r.status === 200,
    "bg-start has responseId": (r) => {
      try {
        return Boolean(r.json("responseId"));
      } catch {
        return false;
      }
    },
  });

  bgStartFailRate.add(!ok);

  if (!ok) {
    failedStartCounter.add(1);
    logFailure("bg-start-failed", res, { typeId });
    return null;
  }

  try {
    return res.json();
  } catch {
    failedStartCounter.add(1);
    logFailure("bg-start-json-parse-failed", res, { typeId });
    return null;
  }
}

function pollGeneration(task, typeId) {
  const maxPolls = 12;

  for (let i = 0; i < maxPolls; i++) {
    const res = http.get(
      `${BASE_URL}/api/bg-check?responseId=${encodeURIComponent(
        task.responseId
      )}&typeId=${encodeURIComponent(typeId)}&title=${encodeURIComponent(
        typeId
      )}`,
      {
        headers: {
          "X-Demo-Access-Code": ACCESS_CODE,
          "User-Agent": "landscape-plan-ai-k6-load-test",
        },
        tags: {
          name: "bg_check",
          typeId,
        },
        timeout: "30s",
      }
    );

    bgCheckDuration.add(res.timings.duration);

    const statusOk = check(res, {
      "bg-check status is 200": (r) => r.status === 200,
    });

    if (!statusOk) {
      bgCheckFailRate.add(true);
      failedCheckCounter.add(1);
      logFailure("bg-check-status-failed", res, { typeId, pollIndex: i });
      return false;
    }

    let done = false;
    let hasError = false;

    try {
      done = res.json("done") === true;
      hasError = Boolean(res.json("error"));
    } catch {
      bgCheckFailRate.add(true);
      failedCheckCounter.add(1);
      logFailure("bg-check-json-parse-failed", res, { typeId, pollIndex: i });
      return false;
    }

    if (hasError) {
      bgCheckFailRate.add(true);
      failedCheckCounter.add(1);
      logFailure("bg-check-api-error", res, { typeId, pollIndex: i });
      return false;
    }

    if (done) {
      const imageOk = check(res, {
        "bg-check has image": (r) => Boolean(r.json("image.imageUrl")),
      });

      bgCheckFailRate.add(!imageOk);

      if (!imageOk) {
        failedCheckCounter.add(1);
        logFailure("bg-check-no-image", res, { typeId, pollIndex: i });
        return false;
      }

      return true;
    }

    sleep(1);
  }

  bgCheckFailRate.add(true);
  failedCheckCounter.add(1);

  console.error(
    JSON.stringify({
      step: "bg-check-timeout",
      typeId,
      maxPolls,
    })
  );

  return false;
}

export default function () {
  const iterationStart = Date.now();

  let accessOk = false;
  let completedCount = 0;

  group("check access code", () => {
    accessOk = checkAccessCode();
  });

  if (!accessOk) {
    completedNineImagesRate.add(false);
    fullIterationDuration.add(Date.now() - iterationStart);
    sleep(1);
    return;
  }

  group("generate nine mock images", () => {
    for (const typeId of DRAWING_TYPES) {
      const task = startGeneration(typeId);

      if (!task) {
        continue;
      }

      const ok = pollGeneration(task, typeId);

      if (ok) {
        completedCount += 1;
      }
    }
  });

  const completedAll = completedCount === DRAWING_TYPES.length;

  completedNineImagesRate.add(completedAll);
  fullIterationDuration.add(Date.now() - iterationStart);

  if (!completedAll) {
    console.error(
      JSON.stringify({
        step: "nine-images-not-completed",
        completedCount,
        expectedCount: DRAWING_TYPES.length,
      })
    );
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(
      {
        summary: "k6 load test finished",
        profile: TEST_PROFILE,
        baseUrl: BASE_URL,
        metrics: {
          checks: data.metrics.checks,
          http_req_failed: data.metrics.http_req_failed,
          http_req_duration: data.metrics.http_req_duration,
          access_fail_rate: data.metrics.access_fail_rate,
          bg_start_fail_rate: data.metrics.bg_start_fail_rate,
          bg_check_fail_rate: data.metrics.bg_check_fail_rate,
          completed_nine_images_rate: data.metrics.completed_nine_images_rate,
          full_iteration_duration: data.metrics.full_iteration_duration,
          access_duration: data.metrics.access_duration,
          bg_start_duration: data.metrics.bg_start_duration,
          bg_check_duration: data.metrics.bg_check_duration,
          iterations: data.metrics.iterations,
          vus: data.metrics.vus,
          vus_max: data.metrics.vus_max,
        },
      },
      null,
      2
    ),
    "load-tests/last-summary.json": JSON.stringify(data, null, 2),
  };
}