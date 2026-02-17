import math

def Time_to_WString(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: WString
    # VAR_INPUT:
    #   Time: Time
    # VAR_TEMP:
    #   Time as DInt: DInt
    #   Hours 10s Place: DInt
    #   Hours 1s Place: DInt
    #   Minutes 10s Place: DInt
    #   Minutes 1s Place: DInt
    #   Seconds 10s Place: DInt
    #   Seconds 1s Place: DInt
    #   Time Elements: Array[0..4] of WString
    #   Length: Int
    #   String Box: WString
    #   DInt Box: DInt
    # VAR CONSTANT:
    #   Milliseconds per 10 Hours: DInt
    context['Milliseconds per 10 Hours'] = 36000000
    #   Milliseconds per Hour: DInt
    context['Milliseconds per Hour'] = 3600000
    #   Milliseconds per 10 Minutes: DInt
    context['Milliseconds per 10 Minutes'] = 600000
    #   Milliseconds per Minute: DInt
    context['Milliseconds per Minute'] = 60000
    #   Milliseconds per 10 Seconds: DInt
    context['Milliseconds per 10 Seconds'] = 10000
    #   Milliseconds per Second: DInt
    context['Milliseconds per Second'] = 1000
    context['Time as DInt'] = context['Time']
    context['Minutes 10s Place'] = (context['Time as DInt'] / context['Milliseconds per 10 Minutes'])
    context['Minutes 1s Place'] = ((context['Time as DInt'] / context['Milliseconds per Minute']) % 10)
    context['Seconds 10s Place'] = ((context['Time as DInt'] % context['Milliseconds per Minute']) / context['Milliseconds per 10 Seconds'])
    context['Seconds 1s Place'] = ((context['Time as DInt'] / context['Milliseconds per Second']) % 10)
    context['Time Elements'][int(0)] = ''
    if ((((context['Minutes 10s Place'] < 0) or (context['Minutes 1s Place'] < 0)) or (context['Seconds 10s Place'] < 0)) or (context['Seconds 1s Place'] < 0)):
        context['Time Elements'][int(0)] = '-'
    context['DInt Box'] = ((context['Minutes 10s Place'] * 10) + context['Minutes 1s Place'])
    context['String Box'] = DINT_TO_WSTRING(IN=context['DInt Box'])
    context['String Box'] = Strip_Sign(WString=context['String Box'])
    context['String Box'] = Add_Leading(Leading_Character='0', Desired_Length=2, String=context['String Box'])
    context['Time Elements'][int(1)] = context['String Box']
    context['Time Elements'][int(2)] = ':'
    context['DInt Box'] = ((context['Seconds 10s Place'] * 10) + context['Seconds 1s Place'])
    context['String Box'] = DINT_TO_WSTRING(IN=context['DInt Box'])
    context['String Box'] = Strip_Sign(WString=context['String Box'])
    context['String Box'] = Add_Leading(Leading_Character='0', Desired_Length=2, String=context['String Box'])
    context['Time Elements'][int(3)] = context['String Box']
    context['Time to WString'] = CONCAT_WSTRING(IN1=context['Time Elements'][int(0)], IN2=context['Time Elements'][int(1)], IN3=context['Time Elements'][int(2)], IN4=context['Time Elements'][int(3)])
