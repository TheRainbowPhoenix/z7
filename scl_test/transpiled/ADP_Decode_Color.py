import math

def ADP_Decode_Color(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_INPUT:
    #   color: String
    #   encoded: ADP: Encoded: Formatting: Color
    #   decoded: ADP: Decoded: Color
    # VAR_TEMP:
    #   _return: String
    if (context['color'] == context['encoded'].black):
        context['_return'] = context['decoded'].black
        pass # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].blue):
        context['_return'] = context['decoded'].blue
        pass # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].green):
        context['_return'] = context['decoded'].green
        pass # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].mix_1):
        context['_return'] = context['decoded'].mix_1
        pass # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].mix_2):
        context['_return'] = context['decoded'].mix_2
        pass # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].mix_3):
        context['_return'] = context['decoded'].mix_3
        pass # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].mix_4):
        context['_return'] = context['decoded'].mix_4
        pass # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].red):
        context['_return'] = context['decoded'].red
        pass # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].white):
        context['_return'] = context['decoded'].white
        pass # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].yellow):
        context['_return'] = context['decoded'].yellow
        pass # GOTO RTRN (Not supported)
    pass # LABEL RTRN
    context['ADP: Decode: Color'] = context['_return']
