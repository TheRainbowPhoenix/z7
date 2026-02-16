import math

def ADP_Decode_Color(context, global_dbs):
    # Return Type: String
    # VAR_INPUT:
    #   color: String
    #   encoded: ADP: Encoded: Formatting: Color
    #   decoded: ADP: Decoded: Color
    # VAR_TEMP:
    #   _return: String
    if (context['color'] == context['encoded'].black):
        context['_return'] = context['decoded'].black
        # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].blue):
        context['_return'] = context['decoded'].blue
        # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].green):
        context['_return'] = context['decoded'].green
        # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].mix_1):
        context['_return'] = context['decoded'].mix_1
        # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].mix_2):
        context['_return'] = context['decoded'].mix_2
        # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].mix_3):
        context['_return'] = context['decoded'].mix_3
        # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].mix_4):
        context['_return'] = context['decoded'].mix_4
        # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].red):
        context['_return'] = context['decoded'].red
        # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].white):
        context['_return'] = context['decoded'].white
        # GOTO RTRN (Not supported)
    if (context['color'] == context['encoded'].yellow):
        context['_return'] = context['decoded'].yellow
        # GOTO RTRN (Not supported)
    # LABEL RTRN
    context['ADP: Decode: Color'] = context['_return']
