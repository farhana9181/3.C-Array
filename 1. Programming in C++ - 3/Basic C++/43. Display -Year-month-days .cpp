#include<iostream>
using namespace std;
int main()
{
    int N,y,m,d;

    cin >> N;

y = N / 365;
 int rA = N % 365;
 int rM = rA % 30;
 m = rA / 30;
 d = rM % 30;

cout<<y<<" ano(s)"<<endl<<m<<" mes(es)"<<endl<<d<<" dia(s)"<<endl;
}
