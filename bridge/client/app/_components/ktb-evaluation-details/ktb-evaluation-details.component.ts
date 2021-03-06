import * as Highcharts from "highcharts";

declare var require: any;
const Boost = require('highcharts/modules/boost');
const noData = require('highcharts/modules/no-data-to-display');
const More = require('highcharts/highcharts-more');
const Heatmap = require("highcharts/modules/heatmap");
const Treemap = require("highcharts/modules/treemap");


Boost(Highcharts);
noData(Highcharts);
More(Highcharts);
noData(Highcharts);
Heatmap(Highcharts);
Treemap(Highcharts);

import * as moment from 'moment';
import {ChangeDetectorRef, Component, Input, OnInit} from '@angular/core';
import {DtChartSeriesVisibilityChangeEvent} from "@dynatrace/barista-components/chart";

import {DataService} from "../../_services/data.service";
import DateUtil from "../../_utils/date.utils";

@Component({
  selector: 'ktb-evaluation-details',
  templateUrl: './ktb-evaluation-details.component.html',
  styleUrls: ['./ktb-evaluation-details.component.scss']
})
export class KtbEvaluationDetailsComponent implements OnInit {

  public _evaluationColor = {
    'pass': '#7dc540',
    'warning': '#fd8232',
    'fail': '#dc172a',
    'info': '#f8f8f8'
  };

  public _evaluationState = {
    'pass': 'recovered',
    'warning': 'warning',
    'fail': 'error'
  };

  public _evaluationData: any;
  public _evaluationSource: string;

  public _selectedEvaluationData: any;

  public _view: string = "singleevaluation";
  public _comparisonView: string = "heatmap";

  public _chartOptions: Highcharts.Options = {
    xAxis: {
      type: 'datetime',
    },
    yAxis: [
      {
        title: null,
        labels: {
          format: '{value}',
        },
        min: 0,
        max: 100,
        tickInterval: 10,
      },
      {
        title: null,
        labels: {
          format: '{value}',
        },
        opposite: true,
        tickInterval: 50,
      },
    ],
    plotOptions: {
      column: {
        stacking: 'normal',
        pointWidth: 5,
        minPointLength: 2,
        point: {
          events: {
            click: (event) => {
              this._chartSeriesClicked(event);
              return true;
            }
          }
        },
      },
    },
  };
  public _chartSeries: Highcharts.IndividualSeriesOptions[] = [
  ];

  public _heatmapOptions: Highcharts.Options = {
    chart: {
      type: 'heatmap',
      height: 400
    },

    title: {
      text: 'Heatmap',
      align: 'left'
    },

    subtitle: {
      text: 'Evalution results',
      align: 'left'
    },

    xAxis: [{
      categories: [],
      labels: {
        enabled: false
      },
    }],

    yAxis: [{
      categories: ["Score"],
      title: null,
      labels: {
        format: '{value}'
      },
    }],

    colorAxis: {
      dataClasses: Object.keys(this._evaluationColor).map((key) => { return { color: this._evaluationColor[key], name: key } })
    },

    plotOptions: {
      heatmap: {
        point: {
          events: {
            click: (event) => {
              this._heatmapTileClicked(event);
              return true;
            }
          }
        },
      },
    },
  };
  public _heatmapSeries: Highcharts.HeatMapSeriesOptions[] = [];

  @Input()
  get evaluationData(): any {
    return this._evaluationData;
  }
  set evaluationData(evaluationData: any) {
    if (this._evaluationData !== evaluationData) {
      this._evaluationData = evaluationData;
      this._changeDetectorRef.markForCheck();
    }
  }

  @Input()
  get evaluationSource(): any {
    return this._evaluationSource;
  }
  set evaluationSource(evaluationSource: any) {
    if (this._evaluationSource !== evaluationSource) {
      this._evaluationSource = evaluationSource;
      this._changeDetectorRef.markForCheck();
    }
  }

  constructor(private _changeDetectorRef: ChangeDetectorRef, private dataService: DataService) { }

  ngOnInit() {
    this.dataService.evaluationResults.subscribe((evaluationData) => {
      if(this.evaluationData === evaluationData) {
        this.updateChartData(evaluationData.evaluationHistory);
        this._changeDetectorRef.markForCheck();
      }
    });
  }

  updateChartData(evaluationHistory) {
    let chartSeries = [];
    let evaluationScoreData = [];

    if(!this._selectedEvaluationData) {
      this._selectedEvaluationData = evaluationHistory[evaluationHistory.length-1].data;
    }

    evaluationHistory.forEach((evaluation) => {
      evaluationScoreData.push({
        x: moment(evaluation.time).unix()*1000,
        y: evaluation.data.evaluationdetails ? evaluation.data.evaluationdetails.score : 0,
        evaluationData: evaluation,
        color: this._evaluationColor[evaluation.data.evaluationdetails.result]
      });

      if(evaluation.data.evaluationdetails.indicatorResults) {
        evaluation.data.evaluationdetails.indicatorResults.forEach((indicatorResult) => {
          let indicatorData = {
            x: moment(evaluation.time).unix()*1000,
            y: indicatorResult.value.value,
            indicatorResult: indicatorResult
          };
          let indicatorChartSeries = chartSeries.find(series => series.name == indicatorResult.value.metric);
          if(!indicatorChartSeries) {
            indicatorChartSeries = {
              name: indicatorResult.value.metric,
              type: 'line',
              yAxis: 1,
              data: [],
              visible: false,
            };
            chartSeries.push(indicatorChartSeries);
          }
          indicatorChartSeries.data.push(indicatorData);
        });
      }
    });
    this._chartSeries = [
      {
        name: 'Score',
        type: 'column',
        data: evaluationScoreData,
        cursor: 'pointer'
      },
      {
        name: 'Score',
        type: 'line',
        data: evaluationScoreData,
        cursor: 'pointer',
        visible: false,
      },
      ...chartSeries
    ];

    this.updateHeatmapOptions(chartSeries);
    this._heatmapSeries = [
      {
        name: 'Score',
        rowsize: 0.85,
        data: evaluationScoreData.map((s) => {
          let time = moment(s.x).format();
          let index = this._heatmapOptions.yAxis[0].categories.indexOf("Score");
          let x = this._heatmapOptions.xAxis[0].categories.indexOf(time);
          return {
            x: x,
            y: index,
            z: s.y,
            evaluation: s.evaluationData,
            color: this._evaluationColor[s.evaluationData.data.result]
          };
        })
      },
      {
        name: 'SLOs',
        data: chartSeries.reverse().reduce((r, d) => [...r, ...d.data.filter(s => s.indicatorResult).map((s) => {
          let time = moment(s.x).format();
          let index = this._heatmapOptions.yAxis[0].categories.indexOf(s.indicatorResult.value.metric);
          let x = this._heatmapOptions.xAxis[0].categories.indexOf(time);
          return {
            x: x,
            y: index,
            z: s.indicatorResult.score,
            color: this._evaluationColor[s.indicatorResult.status]
          };
        })], [])
      },
    ];
  }

  updateHeatmapOptions(chartSeries) {
    chartSeries.forEach((d) =>
      d.data.forEach((s) => {
        if(s.indicatorResult) {
          let time = moment(s.x).format();
          if(this._heatmapOptions.yAxis[0].categories.indexOf(s.indicatorResult.value.metric) == -1)
            this._heatmapOptions.yAxis[0].categories.unshift(s.indicatorResult.value.metric);
          if(this._heatmapOptions.xAxis[0].categories.indexOf(time) == -1)
            this._heatmapOptions.xAxis[0].categories.splice(this.binarySearch(this._heatmapOptions.xAxis[0].categories, time, (a, b) => moment(a).unix() - moment(b).unix()), 0, time);
        }
      })
    )

    this._heatmapOptions.chart.height = this._heatmapOptions.yAxis[0].categories.length*28 + 100;
  }

  switchEvaluationView() {
    this._view = this._view == "singleevaluation" ? "evaluationcomparison" : "singleevaluation";
    if(this._view == "evaluationcomparison") {
      this.dataService.loadEvaluationResults(this._evaluationData, this._evaluationSource);
      this._changeDetectorRef.markForCheck();
    }
  }

  seriesVisibilityChanged(_: DtChartSeriesVisibilityChangeEvent): void {
    // NOOP
  }

  _chartSeriesClicked(event) {
    this._selectedEvaluationData = event.point.evaluationData.data;
  }

  _heatmapTileClicked(event) {
    this._selectedEvaluationData = this._heatmapSeries[0].data[event.point.x]['evaluation'].data;
  }

  getCalendarFormat() {
    return DateUtil.getCalendarFormats().sameElse;
  }

  private binarySearch(ar, el, compare_fn) {
    if(compare_fn(el, ar[0]) < 0)
      return 0;
    if(compare_fn(el, ar[ar.length-1]) > 0)
      return ar.length;
    let m = 0;
    let n = ar.length - 1;
    while (m <= n) {
      let k = (n + m) >> 1;
      let cmp = compare_fn(el, ar[k]);
      if (cmp > 0) {
        m = k + 1;
      } else if(cmp < 0) {
        n = k - 1;
      } else {
        return k;
      }
    }
    return -m - 1;
  }

}
