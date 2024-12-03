import { CONFIG } from "./config.js";

export class PriorityChart {
  constructor(selector) {
    this.svg = d3.select(selector);
    this.init();
  }

  init() {
    this.width = CONFIG.chart.width;
    this.height = CONFIG.chart.height;
    this.margin = CONFIG.chart.margin;
    this.setupScales();
  }

  setupScales() {
    this.xScale = d3
      .scaleLinear()
      .domain([0, 10])
      .range([this.margin.left, this.width - this.margin.right]);

    this.yScale = d3
      .scaleLinear()
      .domain([0, 10])
      .range([this.height - this.margin.bottom, this.margin.top]);
  }

  render(tasks) {
    if (!tasks || !Array.isArray(tasks)) return;

    this.svg.selectAll("*").remove();
    this.svg
      .attr("width", this.width)
      .attr("height", this.height)
      .style("display", "block");

    this.drawQuadrants();
    this.drawAxes();
    this.drawTasks(tasks);
  }

  drawQuadrants() {
    this.svg
      .selectAll("rect")
      .data(CONFIG.chart.quadrants)
      .join("rect")
      .attr("x", (d) => this.xScale(d.x))
      .attr("y", (d) => this.yScale(d.y + d.height))
      .attr("width", (d) => this.xScale(d.width) - this.margin.left)
      .attr(
        "height",
        (d) => this.height - this.margin.bottom - this.yScale(d.height)
      )
      .attr("fill", (d) => d.color)
      .attr("opacity", 0.3);
  }

  drawAxes() {
    this.svg
      .append("g")
      .attr("transform", `translate(0,${this.height - this.margin.bottom})`)
      .call(d3.axisBottom(this.xScale));

    this.svg
      .append("g")
      .attr("transform", `translate(${this.margin.left},0)`)
      .call(d3.axisLeft(this.yScale));
  }

  drawTasks(tasks) {
    const taskGroups = this.svg
      .selectAll(".task")
      .data(tasks)
      .join("g")
      .attr("class", "task");

    taskGroups.append("circle").attr("r", 1).attr("fill", "black");

    taskGroups
      .append("text")
      .attr("x", 8)
      .attr("y", 0)
      .text((d) => d.name)
      .attr("font-size", "25px")
      .attr("alignment-baseline", "middle");

    const connectors = taskGroups
      .append("line")
      .attr("class", "connector")
      .attr("stroke", "#666")
      .attr("stroke-width", 0.5);

    this.setupSimulation(tasks, taskGroups, connectors);
  }

  setupSimulation(tasks, taskGroups, connectors) {
    // Add initial positions to tasks
    tasks.forEach((d) => {
      d.x = this.xScale(d.importance);
      d.y = this.yScale(d.urgency);
    });

    // Create simulation with modified forces
    const simulation = d3
      .forceSimulation(tasks)
      .force("x", d3.forceX((d) => this.xScale(d.importance)).strength(3))
      .force("y", d3.forceY((d) => this.yScale(d.urgency)).strength(3))
      .force("collide", d3.forceCollide().radius(100))
      .force("charge", d3.forceManyBody().strength(-175));

    // Update positions on tick
    simulation.on("tick", () => {
      // Update task groups
      taskGroups.attr("transform", (d) => {
        // Constrain positions within bounds
        const x = Math.max(30, Math.min(this.width - 30, d.x));
        const y = Math.max(30, Math.min(this.height - 30, d.y));
        return `translate(${x},${y})`;
      });

      // Update connectors
      connectors
        .attr("x1", (d) => this.xScale(d.importance) - d.x)
        .attr("y1", (d) => this.yScale(d.urgency) - d.y)
        .attr("x2", 0)
        .attr("y2", 0);
    });
  }
}
