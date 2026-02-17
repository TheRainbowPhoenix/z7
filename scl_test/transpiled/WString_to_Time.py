import math

def WString_to_Time(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Time
    # VAR_INPUT:
    #   WString: WString
    # VAR_TEMP:
    #   Count: UInt
    #   DInt Box: DInt
    #   String Box: WString[5]
    #   Time Box: Time
    #   WChar Array: Array[0..4] of WChar
    # VAR CONSTANT:
    #   ms/(10 hr): DInt
    context['ms/(10 hr)'] = 36000000
    #   ms/hr: DInt
    context['ms/hr'] = 3600000
    #   ms/(10 min): DInt
    context['ms/(10 min)'] = 600000
    #   ms/min: DInt
    context['ms/min'] = 60000
    #   ms/(10 sec): DInt
    context['ms/(10 sec)'] = 10000
    #   ms/sec: DInt
    context['ms/sec'] = 1000
    context['String Box'] = context['WString']
    if (context['String Box'] == ''):
        context['String Box'] = '00:00'
    Strg_TO_Chars(Strg=context['String Box'], pChars=0, Cnt=context['Count'], Chars=context['WChar Array'])
    context['DInt Box'] = (WCHAR_TO_DINT(IN=context['WChar Array'][int(0)]) - 48)
    context['Time Box'] = (context['Time Box'] + (context['DInt Box'] * context['ms/(10 min)']))
    context['DInt Box'] = (WCHAR_TO_DINT(IN=context['WChar Array'][int(1)]) - 48)
    context['Time Box'] = (context['Time Box'] + (context['DInt Box'] * context['ms/min']))
    context['DInt Box'] = (WCHAR_TO_DINT(IN=context['WChar Array'][int(3)]) - 48)
    context['Time Box'] = (context['Time Box'] + (context['DInt Box'] * context['ms/(10 sec)']))
    context['DInt Box'] = (WCHAR_TO_DINT(IN=context['WChar Array'][int(4)]) - 48)
    context['Time Box'] = (context['Time Box'] + (context['DInt Box'] * context['ms/sec']))
    context['WString to Time'] = context['Time Box']
