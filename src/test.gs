  function listModels() {                                                                                                                                                                                                                                             
    var apiKey = getConfig_('GEMINI_API_KEY');          
    var res = UrlFetchApp.fetch(
      'https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey
    );
    var models = JSON.parse(res.getContentText()).models;
    models.forEach(function(m) {
      if (m.supportedGenerationMethods &&
          m.supportedGenerationMethods.indexOf('generateContent') !== -1) {
        Logger.log(m.name);
      }
    });
  }
  function testGemini() {
    var result = chatWithPatient('我的傷口有點滲液', {
      daysPostOp: 7, opName: 'TLIF',
      lastVasBack: 5, lastVasLeg: 3, lastReportDays: 3
    });
    Logger.log(JSON.stringify(result));
  }