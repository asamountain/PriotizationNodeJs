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

    // Create a tooltip div element
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background", "#fff")
      .style("border", "1px solid #ccc")
      .style("padding", "5px")
      .style("border-radius", "4px");

    taskGroups
      .on("mouseover", function (event, d) {
        tooltip
          .html(
            `<strong>${d.name}</strong><br>Importance: ${d.importance}<br>Urgency: ${d.urgency}`
          )
          .style("visibility", "visible");
      })
      .on("mousemove", function (event) {
        tooltip
          .style("top", event.pageY - 10 + "px")
          .style("left", event.pageX + 10 + "px");
      })
      .on("mouseout", function () {
        tooltip.style("visibility", "hidden");
      });

    taskGroups
      .append("polyline")
      .attr("class", "connector")
      .attr("stroke", "#666")
      .attr("stroke-width", 0.5)
      .attr("points", (d) => {
        const x1 = this.xScale(d.importance);
        const y1 = this.yScale(d.urgency);
        const x2 = d.x;
        const y2 = d.y;
        return `${x1},${y1} ${x2},${y2}`;
      });

    taskGroups
      .append("text")
      .attr("x", 8)
      .attr("y", 0)
      .text((d) => d.name)
      .attr("font-size", "14px") // Adjust font size for readability
      .attr("alignment-baseline", "middle");

    const connectors = taskGroups
      .append("line")
      .attr("class", "connector")
      .attr("stroke", "#666")
      .attr("stroke-width", 0.5);

    this.setupSimulation(tasks, taskGroups, connectors);
  }

  setupSimulation(tasks, taskGroups, connectors) {
    tasks.forEach((d) => {
      d.x = this.xScale(d.importance);
      d.y = this.yScale(d.urgency);
    });

    const simulation = d3
      .forceSimulation(tasks)
      .force("x", d3.forceX((d) => this.xScale(d.importance)).strength(1))
      .force("y", d3.forceY((d) => this.yScale(d.urgency)).strength(1))
      .force("collision", d3.forceCollide().radius(50)) // Adjust radius as needed
      .force("charge", d3.forceManyBody().strength(-100)); // Adjust charge for better spacing

    simulation.on("tick", () => {
      taskGroups.attr("transform", (d) => {
        const x = Math.max(30, Math.min(this.width - 30, d.x));
        const y = Math.max(30, Math.min(this.height - 30, d.y));
        return `translate(${x},${y})`;
      });

      connectors
        .attr("x1", (d) => this.xScale(d.importance) - d.x)
        .attr("y1", (d) => this.yScale(d.urgency) - d.y)
        .attr("x2", 0)
        .attr("y2", 0);
    });
  }
}
