import math

def ADP_Encode_Color(context, global_dbs):
    # Return Type: String
    # VAR_INPUT:
    #   color: String
    #   decoded: ADP: Decoded: Color
    #   encoded: ADP: Encoded: Formatting: Color
    # VAR_TEMP:
    #   _return: String
    # VAR CONSTANT:
    #   black: String
    context['black'] = 'BLACK'
    #   blue: String
    context['blue'] = 'BLUE'
    #   green: String
    context['green'] = 'GREEN'
    #   m1: String
    context['m1'] = 'MIX 1'
    #   m2: String
    context['m2'] = 'MIX 2'
    #   m3: String
    context['m3'] = 'MIX 3'
    #   m4: String
    context['m4'] = 'MIX 4'
    #   red: String
    context['red'] = 'RED'
    #   white: String
    context['white'] = 'WHITE'
    #   yellow: String
    context['yellow'] = 'YELLOW'
    if (context['color'] == context['decoded'].black):
        context['_return'] = context['encoded'].black
        # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].blue):
        context['_return'] = context['encoded'].blue
        # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].green):
        context['_return'] = context['encoded'].green
        # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].mix_1):
        context['_return'] = context['encoded'].mix_1
        # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].mix_2):
        context['_return'] = context['encoded'].mix_2
        # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].mix_3):
        context['_return'] = context['encoded'].mix_3
        # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].mix_4):
        context['_return'] = context['encoded'].mix_4
        # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].red):
        context['_return'] = context['encoded'].red
        # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].white):
        context['_return'] = context['encoded'].white
        # GOTO RTRN (Not supported)
    if (context['color'] == context['decoded'].yellow):
        context['_return'] = context['encoded'].yellow
        # GOTO RTRN (Not supported)
    # LABEL RTRN
    context['ADP: Encode: Color'] = context['_return']
